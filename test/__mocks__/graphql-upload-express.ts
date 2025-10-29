import type { RequestHandler } from "express";

const graphqlUploadExpress = (): RequestHandler => (_req, _res, next) => next();

export default graphqlUploadExpress;
