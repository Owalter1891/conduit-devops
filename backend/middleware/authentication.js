const { JsonWebTokenError } = require("jsonwebtoken");
const { UnauthorizedError } = require("../helper/customErrors");
const { jwtVerify } = require("../helper/jwt");
const { User } = require("../models");

const verifyToken = async (req, res, next) => {
  try {
    const { headers } = req;
    if (!headers.authorization) return next();

    const authorization = headers.authorization.match(/^Token\s+(\S+)$/i);
    if (!authorization) throw new UnauthorizedError();
    const token = authorization[1];

    const userVerified = await jwtVerify(token);
    if (typeof userVerified?.email !== "string" || !userVerified.email) {
      throw new UnauthorizedError();
    }

    req.loggedUser = await User.findOne({
      attributes: { exclude: ["email"] },
      where: { email: userVerified.email },
    });

    if (!req.loggedUser) throw new UnauthorizedError();

    headers.email = userVerified.email;
    req.loggedUser.dataValues.token = token;

    next();
  } catch (error) {
    next(error instanceof JsonWebTokenError ? new UnauthorizedError() : error);
  }
};

module.exports = verifyToken;
