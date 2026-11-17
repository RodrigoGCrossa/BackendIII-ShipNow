import MockService from '../services/mock.service.js';
export default class MockController {
 constructor(service=new MockService()) {this.service=service;}
 preview=async(req,res,next)=>{try {res.json(await this.service.preview(req.params.resource,req.query.qty));}catch(error){next(error);}};
 seed=async(req,res,next)=>{try{res.status(201).json(await this.service.seed(req.query.qty,req.body??{}));}catch(error){next(error);}};
}
