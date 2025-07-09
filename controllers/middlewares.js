// as we have 3 users, we can create a middleware to check the user type  and redirect them to the appropriate page
const jwt = require('jsonwebtoken');

const {login}= require('../models/login');
 module.exports = { 
    isAdmin:async (req, res, next) => {
        const token = req.headers['token'];
        if(token){
            try{
                const decoded= jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
                const user = await login.findOne({_id: decoded.userId,status: true}); //not using findbyid to avoid no active user ,because we are using _id as loginid in token model
                if(!user){
                    return res.status(401).json({
                        status: false,
                        message: 'User not found',
                    });
                }
                
               
                if(user.role !== 'admin'){
                    return res.status(403).json({
                        status: false,
                        message: 'Access denied,admin only',
                    });
                }
                req.user = user; // Attach user to request object
            }
            catch(err){
                return res.status(401).json({
                    status: false,
                    message: 'Not verified',
                });
            }
        }
        else{
            return res.status(401).json({
                status: false,
                message: 'Invalid token',
            })
        }
        next();// Call next middleware or route handler
    },
    isUser: async (req, res, next) => {
        const token = req.headers['token'];
        if(token){
            try{
                const decoded= jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
                const user = await login.findOne({_id: decoded.userId,status: true}); //not using findbyid to avoid no active user ,because we are using _id as loginid in token model
                if(!user){
                    return res.status(401).json({
                        status: false,
                        message: 'User not found',
                    });
                }
                
               
                if(user.role !== 'enduser'){
                    return res.status(403).json({
                        status: false,
                        message: 'Access denied,user only',
                    });
                }
                req.user = user; // Attach user to request object
            }
            catch(err){
                return res.status(401).json({
                    status: false,
                    message: 'Not verified',
                });
            }
        }
        else{
            return res.status(401).json({
                status: false,
                message: 'Invalid token',
            })
        }
        next();// Call next middleware or route handler
    },
}