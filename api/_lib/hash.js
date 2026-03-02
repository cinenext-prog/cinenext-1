import crypto from 'crypto';

export const sha256Hex = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const buildMerkleRoot = (values) => {
  const leaves = Array.isArray(values) ? values.filter(Boolean).map((value) => sha256Hex(value)) : [];
  if (leaves.length === 0) {
    return sha256Hex('EMPTY_BATCH');
  }

  let level = leaves;
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      nextLevel.push(sha256Hex(`${left}${right}`));
    }
    level = nextLevel;
  }

  return level[0];
};
