const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
    categoryname: {
        type: String,
    },
    isavailable: {
        type: Number,
    },
    status:
    {
        type: Boolean,
        default: true,
    },
    price: {
        type: Number,
    },
});


const roomSchema = new mongoose.Schema({
    // roomname: {
    //     type: String,
    // },
    noofrooms: {
        type: Number,
    },
    availablerooms: {
        type: Number,
    },
    status: {
        type: Boolean,
        default: true,
    },
});
const Category = mongoose.model('category', categorySchema);
const Room = mongoose.model('room', roomSchema);
module.exports = {Category, Room };