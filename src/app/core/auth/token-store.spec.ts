import { jwtClaims, parseStoredTokens, toStoredTokens } from './token-store';

function fakeJwt(claims: object): string {
  const part = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${part({ alg: 'HS256' })}.${part(claims)}.signature`;
}

describe('token-store', () => {
  it('đổi response của BE sang thời điểm hết hạn tính bằng mili giây', () => {
    const stored = toStoredTokens({
      tokenType: 'Bearer',
      accessToken: 'a',
      accessTokenExpiresAt: '2026-10-07T09:30:00Z',
      refreshToken: 'r',
      refreshTokenExpiresAt: '2026-10-14T09:15:00Z',
    });
    expect(stored.accessExpiresAt).toBe(Date.parse('2026-10-07T09:30:00Z'));
    expect(stored.refreshExpiresAt).toBe(Date.parse('2026-10-14T09:15:00Z'));
  });

  it('chuỗi thời gian hỏng thì dự phòng bằng claim exp của JWT', () => {
    const stored = toStoredTokens(
      {
        tokenType: 'Bearer',
        accessToken: fakeJwt({ exp: 2_000_000_000 }),
        accessTokenExpiresAt: 'không phải ngày',
        refreshToken: 'r',
        refreshTokenExpiresAt: 'không phải ngày',
      },
      1_000,
    );
    expect(stored.accessExpiresAt).toBe(2_000_000_000_000);
    expect(stored.refreshExpiresAt).toBe(1_000 + 60_000);
  });

  it('đọc payload JWT (có ký tự tiếng Việt) và trả null với chuỗi hỏng', () => {
    expect(jwtClaims(fakeJwt({ sub: '12', roles: ['ADMIN'] }))).toEqual({ sub: '12', roles: ['ADMIN'] });
    expect(jwtClaims('khong-phai-jwt')).toBeNull();
    expect(jwtClaims('a.%%%.c')).toBeNull();
  });

  it('parseStoredTokens từ chối dữ liệu thiếu trường hoặc sai kiểu', () => {
    const good = { accessToken: 'a', refreshToken: 'r', accessExpiresAt: 1, refreshExpiresAt: 2 };
    expect(parseStoredTokens(JSON.stringify(good))).toEqual(good);
    expect(parseStoredTokens(JSON.stringify({ ...good, accessExpiresAt: '1' }))).toBeNull();
    expect(parseStoredTokens('{')).toBeNull();
    expect(parseStoredTokens('null')).toBeNull();
  });
});
