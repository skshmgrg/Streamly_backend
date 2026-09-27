const isProduction = process.env.NODE_ENV === 'production';

export const getCookieOptions = (extraOptions = {}) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    ...extraOptions,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

export const getClearCookieOptions = (extraOptions = {}) => ({
  ...getCookieOptions(extraOptions),
  expires: new Date(0),
  maxAge: 0,
});
