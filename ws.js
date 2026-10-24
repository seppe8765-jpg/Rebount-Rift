// Minimal dependency-free WebSocket server side (RFC 6455): handshake + text frames + ping/pong/close.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 64 * 1024;

export function upgrade(req, socket, { onMessage, onClose }) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);

  let buf = Buffer.alloc(0);
  let frag = null; // fragmented message accumulator
  let closed = false;

  const frame = (opcode, payload) => {
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    return Buffer.concat([head, payload]);
  };

  const conn = {
    send(str) {
      if (closed || socket.destroyed) return false;
      if (socket.writableLength > 512 * 1024) return false; // slow client: drop instead of buffering forever
      socket.write(frame(0x1, Buffer.from(str)));
      return true;
    },
    close(code = 1000) {
      if (closed) return;
      closed = true;
      try { const p = Buffer.alloc(2); p.writeUInt16BE(code, 0); socket.write(frame(0x8, p)); } catch (e) { /* ignore */ }
      socket.end();
    },
    get open() { return !closed && !socket.destroyed; },
  };

  const finish = () => { if (!closed) closed = true; onClose && onClose(); };
  socket.on('close', () => { closed = true; onClose && onClose(); onClose = null; });
  socket.on('error', () => { socket.destroy(); });

  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1];
      const fin = !!(b0 & 0x80), opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_PAYLOAD || !masked) { conn.close(1009); socket.destroy(); return; } // clients MUST mask
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (opcode === 0x8) { conn.close(1000); finish(); return; }
      if (opcode === 0x9) { socket.write(frame(0xA, payload)); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x0) {
        if (opcode === 0x1) frag = { parts: [payload] }; else if (frag) frag.parts.push(payload);
        if (fin && frag) {
          const text = Buffer.concat(frag.parts).toString('utf8');
          frag = null;
          try { onMessage(text); } catch (e) { /* a bad message must never crash the server */ }
        }
      }
    }
  });
  return conn;
}
