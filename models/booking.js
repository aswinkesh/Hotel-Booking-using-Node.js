const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "login", // Reference to the user model
        required: true
    },
    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'category'
    },
    noofroomsbooked: {
        type: Number,
        required: true
    },
    checkInDate: {
        type: Date,
        required: true
    },
    checkOutDate: {
        type: Date,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type:Boolean,
        default:true
    },
    createdAt: {
        type: Date,
        default: () => {
        const now = new Date();
        // Add 5 hours 30 minutes in milliseconds
        return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    }
    }
});

module.exports = mongoose.model("booking", bookingSchema); // This creates a model named 'booking' based on the bookingSchema