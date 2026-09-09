import { createHmac, timingSafeEqual } from 'node:crypto';

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

export function verifySignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret || !signedRequest.includes('.')) return null;
  const [encodedSignature, payloadPart] = signedRequest.split('.', 2);

  try {
    const provided = decodeBase64Url(encodedSignature);
    const expected = createHmac('sha256', appSecret).update(payloadPart).digest();
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return null;
    }
    return JSON.parse(decodeBase64Url(payloadPart).toString('utf8'));
  } catch {
    return null;
  }
}
