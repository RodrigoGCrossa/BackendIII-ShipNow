import ProductService from '../services/product.service.js';
export default class ProductController {
 constructor(service=new ProductService()) {this.service=service;}
 getAll=async(req,res,next)=>{try{res.json({status:'success',payload:await this.service.getAll(req.query)});}catch(error){next(error);}};
 getById=async(req,res,next)=>{try{res.json({status:'success',payload:await this.service.getById(req.params.id)});}catch(error){next(error);}};
 create=async(req,res,next)=>{try{res.status(201).json({status:'success',payload:await this.service.create(req.body)});}catch(error){next(error);}};
 update=async(req,res,next)=>{try{res.json({status:'success',payload:await this.service.update(req.params.id,req.body)});}catch(error){next(error);}};
 delete=async(req,res,next)=>{try{res.json({status:'success',payload:await this.service.delete(req.params.id)});}catch(error){next(error);}};
}
