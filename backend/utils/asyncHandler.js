// Express 4 does not catch errors thrown inside async route handlers: a
// rejected promise (for example a malformed ID that Mongoose can't cast) is
// left unhandled, and on modern Node that CRASHES the whole server.
//
// wrapAll() takes a controller's exported functions and returns copies that
// forward any rejection to Express's error handler (see server.js), which
// answers with a proper JSON error instead.
function wrapAll(controller) {
  return Object.fromEntries(
    Object.entries(controller).map(([name, fn]) => [
      name,
      typeof fn === 'function'
        ? (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
        : fn,
    ])
  );
}

module.exports = { wrapAll };
