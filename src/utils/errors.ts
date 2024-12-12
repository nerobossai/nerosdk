export class InvalidAddressError extends Error {
  type;
  statusCode;

  constructor(message = "", ...args: any) {
    super(message, ...args);
    this.message = "address is invalid";
    this.type = "INVALID_ADDRESS_ERROR";
    this.statusCode = 400;
  }
}

export class BadRequestError extends Error {
  type;
  statusCode;

  constructor(message = "", ...args: any) {
    super(message, ...args);
    this.message = "bad request";
    this.type = "BAD_REQUEST_ERROR";
    this.statusCode = 400;
  }
}
