const mongoose=require('mongoose');
const tokenschema=new mongoose.Schema({
    loginid : {
        type : mongoose.Schema.Types.ObjectId,
        ref: 'login' //reference of login model
    },
    token : {
        type : String
    }
})


// module.exports=mongoose.model('token',tokenschema)
const token = mongoose.model('token',tokenschema)
module.exports={token} //2 line code in one line