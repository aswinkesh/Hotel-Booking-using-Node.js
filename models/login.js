const mongoose=require('mongoose');
const loginschema = new mongoose.Schema({
    email : {
        type : String,
    },
    password : {
        type : String,
    },
    role : {
        type : String,
        enum : ['admin','enduser','hotelowner'],
    },
    status : {
        type : Boolean,
        default : true,
    },
    name : {
        type: String,
    },
    phoneno : {
        type : Number,
    },
    
})
const login = mongoose.model('login',loginschema)

module.exports={login}