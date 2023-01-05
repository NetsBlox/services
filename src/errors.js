
class RequestError extends Error {
    constructor(status, msg) {
        super(msg);
        this.status = status;
    }
}

class MissingClientIdError extends RequestError {
    constructor() {
        super(400, 'Client ID is required.');
    }
}

class NotFoundError extends RequestError {
    constructor(msg) {
        super(404, msg);
    }
}

class ServiceNotFoundError extends RequestError {
    constructor(serviceName) {
        super(`Service "${serviceName}" is not available.`);
    }
}

class RPCNotFoundError extends RequestError {
    constructor(rpcName) {
        super(`RPC "${rpcName}" is not available.`);
    }
}

module.exports = {
    RequestError,
    MissingClientIdError,
    ServiceNotFoundError,
    RPCNotFoundError,
};
