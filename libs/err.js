
function ClientError(message) {
    this.message = message;
    Error.captureStackTrace(this, ClientError);
}
ClientError.prototype = Object.create(Error.prototype);
ClientError.prototype.constructor = ClientError;
ClientError.prototype.isclient = true;

// builds a client error, that is an error that the user can see
exports.client = function(message){
	return new ClientError(message);
}
