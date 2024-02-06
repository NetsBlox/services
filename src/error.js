class UserError extends Error {
}

class RequestError extends UserError {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}

class NotAllowedError extends RequestError {
  constructor() {
    super(403, "Not allowed.");
  }
}

class InvalidKeyProviderError extends RequestError {
  constructor(provider) {
    super(400, `Invalid API for API Key: ${provider}`);
  }
}

class MissingFieldError extends RequestError {
  constructor(field) {
    super(400, `Missing required field: ${field}`);
  }
}

function handleUserErrors(fn) {
  return async function (_req, res) {
    try {
      await fn.call(this, ...arguments);
    } catch (err) {
      if (err instanceof RequestError) {
        res.status(err.status).send(err.message);
      } else {
        console.warn(err.stack);
        res.status(500).send("Internal error occurred. Try again later!");
      }
    }
  };
}

class LoginRequired extends RequestError {
  constructor() {
    super(401, "Login Required.");
  }
}

module.exports = {
  UserError,
  NotAllowedError,
  InvalidKeyProviderError,
  MissingFieldError,
  LoginRequired,

  handleUserErrors,
};
