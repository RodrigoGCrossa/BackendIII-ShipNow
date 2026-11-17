import {ERRORS} from './catalog.js';
export default class AppError extends Error {
 constructor(code='INTERNAL_ERROR',message,options={}) {const definition=ERRORS[code]??ERRORS.INTERNAL_ERROR;super(message??definition.message,options);this.name='AppError';this.code=definition.code;this.statusCode=definition.statusCode;this.isOperational=true;}
}
