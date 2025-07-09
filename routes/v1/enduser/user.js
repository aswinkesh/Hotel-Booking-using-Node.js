const express = require ('express');
const {Category, Room} = require('../../../models/category');
const isUser = require('../../../controllers/middlewares').isUser; //if curly then .isuser is not required
const Booking = require('../../../models/booking');
const router = express();
const {sendTextEmail} = require('../../../controllers/email');
const {login} = require('../../../models/login');



router.get('/v1/user/getcategories',isUser, async(req,res)=>{
    try
    {
        const categories = await Category.find({ status: true });
        res.status(200).json({
            status: true,
            message: 'Categories retrieved successfully',
            data: categories
        });
    }
    catch (er) 
    {
        console.error(er); 
        res.status(500).json({
            status:false,
            message: 'Internal Server Error',
        })
    }
})

router.post('/v1/enduser/bookrooms', isUser, async (req, res) => {
    try {
        const { categoryId, noOfRoomsBooked, checkInDate, checkOutDate } = req.body;

        // Validate input
        if (!categoryId || !noOfRoomsBooked || !checkInDate || !checkOutDate) {
            return res.status(400).json({
                status: false,
                message: 'All fields are required',
            });
        }

        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: 'Category not found',
            });
        }

        // Check availability
        if (category.isavailable < noOfRoomsBooked) {
            return res.status(400).json({
                status: false,
                message: 'Not enough rooms available',
            });
        }

        const checkInUTC = new Date(checkInDate);
        const checkOutUTC = new Date(checkOutDate);

        const diffdate=24 * 60 * 60 * 1000; // 24 hours in milliseconds
        let days= Math.ceil((checkOutUTC - checkInUTC) / diffdate);
        if(days<1)days=1; // Ensure at least one day booking

        const priceperroom = category.price || 0;
        const totalAmount = priceperroom * noOfRoomsBooked * days;

        // if (days > 3) {
        //     return res.status(400).json({
        //         status: false,
        //         message: 'You can only book up to the next 3 days from the check-in date',
        //     });
        // }

        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const checkIn = new Date(checkInDate);

        if (checkIn > threeDaysFromNow) {
            return res.status(400).json({
                status: false,
                message: 'Bookings can only be made within 3 days from now'
            });
        }

        // Check if the total bookings for the check-in date exceed 15
        const bookingsCount = await Booking.countDocuments({
            checkInDate: {
            $gte: new Date(checkInDate).setHours(0, 0, 0, 0),
            $lt: new Date(checkInDate).setHours(23, 59, 59, 999)
            }
        });

        if (bookingsCount >= 15) {
            return res.status(400).json({
            status: false,
            message: 'Maximum bookings reached for the selected check-in date'
            });
        }
        

        // Create booking
        const booking = new Booking({
            user: req.user._id,
            category: categoryId,
            noofroomsbooked: noOfRoomsBooked,
            checkInDate,
            checkOutDate,
            totalAmount
        });

        await booking.save();

        // Update category availability
        category.isavailable -= noOfRoomsBooked;
        await category.save();

        await sendTextEmail(
            req.user.email,
            'Room Booking Confirmation',
            `Dear ${req.user.name || 'User'},\n\nYour booking has been confirmed.\n\nBooking Details:\n- Category: ${category.categoryname}\n- Number of Rooms: ${noOfRoomsBooked}\n- Check-In Date: ${checkInDate}\n- Check-Out Date: ${checkOutDate}\n- Total Amount: ${totalAmount}\n\nThank you for booking with us!`
        );
        
        const user = await login.findById(req.user._id);
        const bookingHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 48px auto; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 32px rgba(37,99,235,0.12), 0 1.5px 6px #e0e7ff; background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%); border: 1.5px solid #dbeafe;">
        <div style="background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%); padding: 28px 0; text-align: center;">
          <svg width="56" height="56" fill="none" viewBox="0 0 24 24" style="margin-bottom: 8px;">
        <circle cx="12" cy="12" r="12" fill="#fff" opacity="0.15"/>
        <path d="M7 13l3 3 7-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 style="color: #fff; font-size: 2rem; margin: 0;">Booking Confirmed!</h2>
          <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 1.1rem;">Your reservation is secured 🎉</p>
        </div>
        <div style="padding: 32px 28px 18px 28px;">
          <p style="font-size: 1.1rem; color: #222; text-align: center; margin-bottom: 22px;">
        Hi <span style="color: #2563eb; font-weight: 600;">${user.name || 'User'}</span>,<br>
        We're excited to let you know your booking was <b>successful</b>!
          </p>
          <div style="margin: 0 auto 28px auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px #e0e7ff; padding: 22px 18px 18px 18px; max-width: 340px;">
        <table style="width:100%; font-size:1.05rem; color:#222; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: 500; color: #2563eb;">Category:</td>
            <td style="padding: 8px 0;">${category.categoryname}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 500; color: #2563eb;">Rooms Booked:</td>
            <td style="padding: 8px 0;">${noOfRoomsBooked}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 500; color: #2563eb;">Check-In:</td>
            <td style="padding: 8px 0;">${checkInUTC.toDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 500; color: #2563eb;">Check-Out:</td>
            <td style="padding: 8px 0;">${checkOutUTC.toDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 500; color: #2563eb;">Total Amount:</td>
            <td style="padding: 8px 0; color: #059669; font-weight: 600;">₹${totalAmount}</td>
          </tr>
        </table>
          </div>
       
          <p style="font-size: 0.98rem; color: #666; text-align: center; margin-bottom: 0;">Thank you for booking with us!<br>We look forward to your stay.</p>
        </div>
        <div style="background: #f1f5f9; padding: 18px 0 12px 0; border-top: 1.5px solid #e0e7ff;">
          <p style="font-size: 0.85rem; color: #cbd5e1; text-align: center; margin: 8px 0 0 0;">&copy; ${new Date().getFullYear()} Your Hotel Name</p>
        </div>
      </div>
    `;
        // Send confirmation email to user
        if (user && user.email) {
            await sendTextEmail(
                user.email,
                'Booking Confirmation',
                undefined, // No plain text body
                bookingHtml
            );
}

        res.status(201).json({
            status: true,
            message: 'Room booked successfully',
            data: booking,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error',
        });
    }
});


router.post('/v1/enduser/cancelbooking', isUser, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({
        status: false,
        message: 'Booking ID is required',
      });
    }

    // Find the booking
    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
    if (!booking) {
      return res.status(404).json({
        status: false,
        message: 'Booking not found',
      });
    }
      const category = await Category.findById(booking.category);

    if(booking.status === false) {
      return res.status(400).json({ status: false, message: `${category ? category.categoryname : ''} Booking is already cancelled` });
    }

    // Find the category to restore room availability
  
    if (category) {
      category.isavailable += booking.noofroomsbooked;
      await category.save();
    }

    // Mark the booking as cancelled (set status to false)
    booking.status = false;
    await booking.save();

    // Send cancellation email
    const user = await login.findById(req.user._id);
    const cancelHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 48px auto; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 32px rgba(239,68,68,0.12), 0 1.5px 6px #fee2e2; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1.5px solid #fecaca;">
      <div style="background: linear-gradient(90deg, #ef4444 0%, #fca5a5 100%); padding: 28px 0; text-align: center;">
        <svg width="56" height="56" fill="none" viewBox="0 0 24 24" style="margin-bottom: 8px;">
          <circle cx="12" cy="12" r="12" fill="#fff" opacity="0.15"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2 style="color: #fff; font-size: 2rem; margin: 0;">Booking Cancelled</h2>
        <p style="color: #fee2e2; margin: 8px 0 0 0; font-size: 1.1rem;">Your reservation has been cancelled</p>
      </div>
      <div style="padding: 32px 28px 18px 28px;">
        <p style="font-size: 1.1rem; color: #222; text-align: center; margin-bottom: 22px;">
          Hi <span style="color: #ef4444; font-weight: 600;">${user.name || 'User'}</span>,<br>
          Your booking has been <b>cancelled</b> as per your request.
        </p>
        <div style="margin: 0 auto 28px auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px #fee2e2; padding: 22px 18px 18px 18px; max-width: 340px;">
          <table style="width:100%; font-size:1.05rem; color:#222; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #ef4444;">Category:</td>
              <td style="padding: 8px 0;">${category ? category.categoryname : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #ef4444;">Rooms Booked:</td>
              <td style="padding: 8px 0;">${booking.noofroomsbooked}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #ef4444;">Check-In:</td>
              <td style="padding: 8px 0;">${new Date(booking.checkInDate).toDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #ef4444;">Check-Out:</td>
              <td style="padding: 8px 0;">${new Date(booking.checkOutDate).toDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #ef4444;">Total Amount:</td>
              <td style="padding: 8px 0; color: #b91c1c; font-weight: 600;">₹${booking.totalAmount}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 0.98rem; color: #666; text-align: center; margin-bottom: 0;">If you have any questions, please contact us.<br>We hope to serve you in the future.</p>
      </div>
      <div style="background: #fef2f2; padding: 18px 0 12px 0; border-top: 1.5px solid #fee2e2;">
        <p style="font-size: 0.85rem; color: #fecaca; text-align: center; margin: 8px 0 0 0;">&copy; ${new Date().getFullYear()} Your Hotel Name</p>
      </div>
    </div>
    `;
    if (user && user.email) {
      await sendTextEmail(
        user.email,
        'Booking Cancellation',
        undefined,
        cancelHtml
      );
    }

    res.status(200).json({
      status: true,
      message: `${category ? category.categoryname : ''} Booking cancelled successfully`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
});

module.exports=router;