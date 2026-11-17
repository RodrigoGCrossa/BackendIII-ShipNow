import winston from 'winston';
import {mkdir} from 'node:fs/promises';
import config from './index.js';
export const LOG_LEVELS=Object.freeze({fatal:0,error:1,warning:2,info:3,http:4,debug:5});
export async function buildLogger({nodeEnv,logLevel,logDir}) {
 await mkdir(logDir,{recursive:true});
 const format=winston.format.combine(winston.format.timestamp(),winston.format.json());
 const transports=[new winston.transports.File({dirname:logDir,filename:'error.log',level:'error',maxsize:1024*1024,maxFiles:5,tailable:true}),new winston.transports.File({dirname:logDir,filename:'combined.log',level:logLevel,maxsize:5*1024*1024,maxFiles:5,tailable:true})];
 if(nodeEnv==='development') transports.push(new winston.transports.Console({format:winston.format.combine(winston.format.timestamp(),winston.format.printf(({timestamp,level,message})=>`${timestamp} [${level}] ${message}`))}));
 return winston.createLogger({levels:LOG_LEVELS,level:logLevel,format,transports,exitOnError:false});
}
const logger=await buildLogger(config);
export default logger;
