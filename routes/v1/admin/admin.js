const express = require ('express');
const jwt=require('jsonwebtoken');
const bcryptjs=require('bcryptjs');
const {login}=require('../../../models/login');
const {token}=require('../../../models/token');
const {Category, Room} = require('../../../models/category');
const isAdmin = require('../../../controllers/middlewares').isAdmin; //if curly then .isadmin is not required
const isUser = require('../../../controllers/middlewares').isUser; //if curly then .isuser is not required
const {Otp} = require('../../../models/otp');
const {sendTextEmail} = require('../../../controllers/email');
const ExcelJS = require('exceljs');


const randomstring = require('randomstring');

const router = express();



router.post(
    '/v1/admin/register', async(req,res)=>{
        try
        {
            const { name,email,phoneno,password,role} = req.body;
            if(!name || !email || !phoneno || !password || !role)
            {
                return res.status(400).json({
                    status:false,
                    message: 'All fields are required',
                    
                })
            }
            if(name.length < 2 || name.length > 30){
                return res.status(400).json({
                    status:false,
                    message: 'Name must be between 2 and 30 characters',
                })
            }
            if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
                return res.status(400).json({
                    status: false,
                    message: 'Name can only contain alphabets and single spaces between first, middle, and last names',
                });
            }


            if(/^\S+@\S+\.\S+$/.test(email) === false)
            {
                return res.status(400).json({
                    status:false,
                    message: 'Invalid email format',
                })
            }

            if (!email.endsWith('.com') && !email.endsWith('.in')) {
                return res.status(400).json({
                    status: false,
                    message: 'Only .com and .in email addresses are allowed',
                });
            }

        const existingInactiveUser = await login.findOne({ email: email, status: false });
        if (existingInactiveUser) {
            await login.deleteMany({ email: email, status: false });
        } 

         

            const existingUser = await login.findOne({ email: email ,status: true }); //status:true means only active users
            if (existingUser) {
                return res.status(400).json({
                    status: false,
                    message: 'User with this email already exists',
                });
            }




            const existingadmin = await login.findOne({ role: 'admin' });
        if (existingadmin && role === 'admin') {
            return res.status(409).json({
                status: false,
                message: 'Admin user already exists'
            });
        }
        if(!/^\d{10}$/.test(phoneno))
        {
            return res.status(400).json({
                status:false,
                message: 'Invalid phone number format',
            })
            }
            if(phoneno === "1234567890") {
                return res.status(400).json({
                    status:false,
                    message: 'Phone number cannot be 1234567890',
                })
            }
            if (/[^0-9]/.test(phoneno)) {
                return res.status(400).json({
                    status: false,
                    message: 'Phone number cannot contain special characters',
                });
            }
            const existingUser2 = await login.findOne({ phoneno: phoneno ,status: true }); //status:true means only active users
            if (existingUser2) {
                return res.status(400).json({
                    status: false,
                    message: 'User with this phone number already exists',
                });
            }

            if(role !== 'admin' && role !== 'enduser' && role !== 'hotelowner')
            {
                return res.status(400).json({
                    status:false,
                    message: 'Invalid role',
                })
            }

        if (password.length < 8 || 
            !/[A-Z]/.test(password) || 
            !/[a-z]/.test(password) || 
            !/[0-9]/.test(password) || 
            !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
            });
        }
       

            const hashedpassword = await bcryptjs.hash(password, 10); //10 is the salt rounds,it means how many times the password will be hashed

            if (role === 'admin') {
                const newUser = new login({
                    email,
                    password: hashedpassword,
                    role,
                    name,
                    phoneno,
                    status: true // Admin is active immediately
                });
                await newUser.save();
                return res.status(201).json({
                    status: true,
                    message: 'Admin registered successfully.'
                });
            }

            // Only send OTP for non-admin users
            const otp = randomstring.generate({ length: 4, charset: 'numeric' });
            const expiresat = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes
            await Otp.findOneAndUpdate(
                { email },
                { otp: otp, expiresat },
                { upsert: true, new: true }
            );
            await sendTextEmail(email, 'Test OTP Email', `Your OTP is: ${otp}`);
            res.status(200).json({ status: true, message: 'OTP email sent successfully', otp });


            const newUser = new login({
                name: name,
                email: email,
                phoneno: phoneno,
                password: hashedpassword,
                role: role,
                status: false // Initially set status to false until OTP verification
            });

            await newUser.save(); // Save the new user to the database
         
            res.status(201).json({
                status:true,
                message: 'User registered successfully',
            })
        }
        catch(er) 
        {
            console.error(er); 
            res.status(500).json({
                status:false,
                message: 'Internal Server Error',
            })
        }
    }
)

router.post('/v1/admin/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await Otp.findOne({ email, otp });

        if (!email || !otp) {
            return res.status(400).json({ status: false, message: 'Email and OTP are required' });
        }
        if (/^\S+@\S+\.\S+$/.test(email) === false) {
            return res.status(400).json({ status: false, message: 'Invalid email format' });
        }

        if (!otpRecord || otpRecord.expiresat < new Date()) {
            return res.status(400).json({ status: false, message: 'Invalid or expired OTP' });
        }

        // Activate user
        const user = await login.findOne({ email });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        user.status = true;
        await user.save();

        const adminUser = await login.findOne({ role: 'admin' });
        if (adminUser && adminUser.email) {
            const notifyHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; border-radius: 8px; padding: 24px; background: #fafbfc;">
                    <h2 style="color: #2d8cf0;">New User Registered</h2>
                    <p style="font-size: 16px; color: #333;">A new user has completed registration and verified their email.</p>
                    <div style="margin: 16px 0;">
                        <strong>Email:</strong> ${user.email}<br>
                        <strong>Name:</strong> ${user.name}<br>
                        <strong>Phone:</strong> ${user.phoneno}
                    </div>
                    <p style="font-size: 12px; color: #bbb;">This is an automated notification.</p>
                </div>
            `;
            await sendTextEmail(
                adminUser.email,
                'New User Registered',
                `A new user has registered: ${user.email}`,
                notifyHtml
            );
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: user._id, role: user.role },
            'your_secret_key',
            { expiresIn: '1h' }
        );

        // Save token in database
        const newToken = new token({
            loginid: user._id,
            token: jwtToken
        });

        await newToken.save();

        // Remove OTP record
        await Otp.deleteOne({ email });

        res.status(200).json({ status: true, message: 'Account activated. You can now log in.' });
    } catch (error) {
        console.error('Error during OTP verification:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
});


router.post('/v1/admin/login', async(req,res)=>{
    try
    {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: false,
                message: 'Email and password are required',
            });
        }

        if (/^\S+@\S+\.\S+$/.test(email) === false) {
            return res.status(400).json({
                status: false,
                message: 'Invalid email format',
            });
        }
        if (password.length < 8 ||
            !/[A-Z]/.test(password) ||
            !/[a-z]/.test(password) ||
            !/[0-9]/.test(password) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
            });
        }

        const user = await login.findOne({ email: email });
        if (!user) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email or password',
            });
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email or password',
            });
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: user._id, role: user.role },
            'your_secret_key',
            { expiresIn: '1h' }
        );

        // Save token in database
        const newToken = new token({
            loginid: user._id,
            token: jwtToken
        });

        await newToken.save();

        res.status(200).json({
            status: true,
            message: 'Login successful',
            token: jwtToken,
            role: user.role
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

// router.post('/v1/admin/category', isAdmin, async (req, res) => {
//     try {
//         const { id, categoryname, isavailable } = req.body;

//         if (!categoryname || isavailable === undefined) {
//             return res.status(400).json({
//                 status: false,
//                 message: 'Category name and availability status are required',
//             });
//         }

//         if (typeof categoryname !== 'string' || categoryname.length < 2 || categoryname.length > 30) {
//             return res.status(400).json({
//                 status: false,
//                 message: 'Category name must be a string between 2 and 30 characters',
//             });
//         }
//         if (!/^[a-zA-Z\s]+$/.test(categoryname)) {
//             return res.status(400).json({
//                 status: false,
//                 message: 'Category name must contain only letters and spaces',
//             });
//         }
//         if (typeof isavailable !== 'number' || !Number.isInteger(isavailable) || isavailable < 1) {
//             return res.status(400).json({
//                 status: false,
//                 message: 'Number of rooms (isavailable) must be an integer greater than 0',
//             });
//         }

//         if (id) {
//             // Update category
//             const existingCategory = await Category.findById(id);
//             if (!existingCategory) {
//                 return res.status(404).json({
//                     status: false,
//                     message: 'Category not found',
//                 });
//             }
//             existingCategory.categoryname = categoryname;
//             existingCategory.isavailable = isavailable;
//             await existingCategory.save();
//             return res.status(200).json({
//                 status: true,
//                 message: 'Category updated successfully',
//             });
//         } else {
//             // Add new category
//             const existingCategory = await Category.findOne({ categoryname: categoryname.trim() });
//             if (existingCategory) {
//                 return res.status(409).json({
//                     status: false,
//                     message: 'Category with this name already exists',
//                 });
//             }
//             const newCategory = new Category({
//                 categoryname: categoryname,
//                 isavailable: isavailable
//             });
//             await newCategory.save();
//             return res.status(201).json({
//                 status: true,
//                 message: 'Category added successfully',
//             });
//         }
//     } catch (error) {
//         console.error('Error in add/update category:', error);
//         res.status(500).json({
//             status: false,
//             message: 'Internal server error'
//         });
//     }
// });

router.post('/v1/admin/addcategory',isAdmin, async(req,res)=>{
    try
    {
        const { categoryname, isavailable, price } = req.body;
        if (!categoryname || isavailable === undefined || price === undefined) {
            return res.status(400).json({
                status: false,
                message: 'Category name, availability status, and price are required',
            });
        }

        if (typeof categoryname !== 'string' || categoryname.length < 2 || categoryname.length > 30) {
            return res.status(400).json({
                status: false,
                message: 'Category name must be a string between 2 and 30 characters',
            });
        }
        // Check for existing category (case-insensitive)
        const existingCategory = await Category.findOne({ categoryname: { $regex: `^${categoryname}$`, $options: 'i' } });
        if (existingCategory) {
            return res.status(400).json({
            status: false,
            message: 'Category already exists',
            });
        }

        

        if (typeof isavailable !== 'number' || !Number.isInteger(isavailable) || isavailable < 0) {
            return res.status(400).json({
            status: false,
            message: 'Number of rooms (isavailable) must be an integer greater than or equal to 0',
            });
        }
        if (typeof price !== 'number' || price <= 0) {
            return res.status(400).json({
                status: false,
                message: 'Price must be a positive number',
            });
        }

        const newCategory = new Category({
            categoryname: categoryname,
            isavailable: isavailable,
            price: price
        });

        await newCategory.save();
        res.status(201).json({
            status: true,
            message: 'Category added successfully',
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

router.get('/v1/admin/getcategories',isAdmin, async(req,res)=>{
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


router.delete('/v1/admin/deletecategory/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        
        if (!category) {
            return res.status(404).json({
                status: false,
                message: 'Category not found',
            });
        }

        category.status = false; // Set status to false instead of deleting
        await category.save();


        res.status(200).json({
            status: true,
            message: 'Category deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.put('/v1/admin/updatecategory/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { categoryname, isavailable , price } = req.body;

        if (!categoryname || isavailable === undefined || price === undefined) {
            return res.status(400).json({
                status: false,
                message: 'Category name, availability status, and price are required',
            });
        }

        if (typeof categoryname !== 'string' || categoryname.length < 2 || categoryname.length > 30) {
            return res.status(400).json({
                status: false,
                message: 'Category name must be a string between 2 and 30 characters',
            });
        }
        if (!/^[a-zA-Z\s]+$/.test(categoryname)) {
            return res.status(400).json({
                status: false,
                message: 'Category name must contain only letters and spaces',
            });
        }

        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({
                status: false,
                message: 'Category not found',
            });
        }

        if (typeof isavailable !== 'number' || !Number.isInteger(isavailable) || isavailable < 1) {
            return res.status(400).json({
                status: false,
                message: 'Number of rooms (isavailable) must be an integer greater than 0',
            });
        }
        if(typeof price !== 'number' || price <= 0) {
            return res.status(400).json({
                status: false,
                message: 'Price must be a positive number',
            });
        }

        existingCategory.categoryname = categoryname;
        existingCategory.isavailable = isavailable;
        existingCategory.price = price;

        await existingCategory.save();
        res.status(200).json({
            status: true,
            message: 'Category updated successfully',
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/totalusers', isAdmin, async (req, res) => {
    try {
        const totalUsers = await login.countDocuments({ role: 'enduser' });
        const users = await login.find({ role: 'enduser' }, '-password');// Count only users
       res.status(200).json({
    status: true,
    message: 'Total users retrieved successfully',
    data: {
        totalUsers,
        users
    }
});
}
 catch (error) {
        console.error('Error retrieving users:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});



router.get('/v1/admin/totalusers/pdf', isAdmin, async (req, res) => {
    try {
        const users = await login.find({ role: 'enduser' }, '-password');

        // Prepare table headers and body
        const body = [
            [
                { text: 'Name', bold: true },
                { text: 'Email', bold: true },
                { text: 'Phone', bold: true },
                { text: 'Status', bold: true },
                { text: 'Role', bold: true },
               
            ]
        ];
        users.forEach(user => {
            body.push([
                user.name || '',
                user.email || '',
                user.phoneno ? user.phoneno.toString() : '',
                user.status ? 'Active' : 'Inactive',
                user.role || '',
              
            ]);
        });

        // Define document
        const docDefinition = {
    content: [
        { text: 'Total Users List', style: 'header', alignment: 'center' },
        {
            table: {
                headerRows: 1,
                widths: [80, 150, 80, 60, 70, 110], // Set explicit widths for each column
                body: body
            },
            layout: {
                fillColor: function (rowIndex) {
                    return rowIndex === 0 ? '#eeeeee' : null;
                }
            }
        }
    ],
    styles: {
        header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10]
        },
        tableBody: {
            fontSize: 9 // Reduce font size for table content
        }
    },
    defaultStyle: {
        font: 'Helvetica'
    }
};

        // Use built-in Helvetica font
        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };

        const PdfPrinter = require('pdfmake');
        const printer = new PdfPrinter(fonts);
        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="total_users.pdf"');
        pdfDoc.pipe(res);
        pdfDoc.end();
    } catch (error) {
        console.error('Error generating total users PDF:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/totalusers/getpdf', isAdmin, async (req, res) => {
    try {
        const users = await login.find({ role: 'enduser' }, '-password');

        // Prepare table headers and body
        const body = [
            [
                { text: 'Name', bold: true },
                { text: 'Email', bold: true },
                { text: 'Phone', bold: true },
                { text: 'Status', bold: true },
                { text: 'Role', bold: true },
            ]
        ];
        users.forEach(user => {
            body.push([
                user.name || '',
                user.email || '',
                user.phoneno ? user.phoneno.toString() : '',
                user.status ? 'Active' : 'Inactive',
                user.role || '',
            ]);
        });

        // Define document
        const docDefinition = {
            content: [
                { text: 'Total Users List', style: 'header', alignment: 'center' },
                {
                    table: {
                        headerRows: 1,
                        widths: [80, 150, 80, 60, 70], // Adjust as needed
                        body: body
                    },
                    layout: {
                        fillColor: function (rowIndex) {
                            return rowIndex === 0 ? '#eeeeee' : null;
                        }
                    }
                }
            ],
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                tableBody: {
                    fontSize: 9
                }
            },
            defaultStyle: {
                font: 'Helvetica'
            }
        };

        // Use built-in Helvetica font
        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };

        const PdfPrinter = require('pdfmake');
        const printer = new PdfPrinter(fonts);

        // Generate PDF as Buffer and stream to response
        const chunks = [];
        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', async () => {
            const pdfBuffer = Buffer.concat(chunks);

            // Send email to admin
            const adminUser = await login.findOne({ role: 'admin' });
            if (adminUser && adminUser.email) {
                await sendTextEmail(
                    adminUser.email,
                    'Total Users PDF',
                    'Please find attached the latest total users list.',
                    null,
                    [
                        {
                            filename: 'total_users.pdf',
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                );
            }

            // Send PDF to Postman
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="total_users.pdf"');
            res.send(pdfBuffer);
        });

        pdfDoc.end();
    } catch (error) {
        console.error('Error generating/sending total users PDF:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});



router.get('/v1/admin/totalusers/excel', isAdmin, async (req, res) => {
    try {
        const users = await login.find({ role: 'enduser' }, '-password');

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Total Users');

        // Add header row
        worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Role']);

        // Add user data rows
        users.forEach(user => {
            worksheet.addRow([
                user.name || '',
                user.email || '',
                user.phoneno ? user.phoneno.toString() : '',
                user.status ? 'Active' : 'Inactive',
                user.role || ''
            ]);
        });

        // Set header styles
        worksheet.getRow(1).font = { bold: true };

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="total_users.xlsx"');

        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/totalusers/getexcel', isAdmin, async (req, res) => {
    try {
        const users = await login.find({ role: 'enduser' }, '-password');

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Total Users');

        // Add header row
        worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Role']);

        // Add user data rows
        users.forEach(user => {
            worksheet.addRow([
                user.name || '',
                user.email || '',
                user.phoneno ? user.phoneno.toString() : '',
                user.status ? 'Active' : 'Inactive',
                user.role || ''
            ]);
        });

        // Set header styles
        worksheet.getRow(1).font = { bold: true };

        // Write workbook to buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Send email to admin
        const adminUser = await login.findOne({ role: 'admin' });
        if (adminUser && adminUser.email) {
            await sendTextEmail(
                adminUser.email,
                'Total Users Excel',
                'Please find attached the latest total users list in Excel format.',
                null,
                [
                    {
                        filename: 'total_users.xlsx',
                        content: buffer,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                ]
            );
        }

        // Send Excel to Postman
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="total_users.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating/sending Excel file:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});


router.get('/v1/admin/activeusers', isAdmin, async (req, res) => { 
    try {
        const activeUsers = await login.find({ status: true }, '-password');
        res.status(200).json({
            status: true,
            message: 'Active users retrieved successfully',
            data: activeUsers
        });
    } catch (error) {
        console.error('Error retrieving active users:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/inactiveusers', isAdmin, async (req, res) => {
    try {
        const inactiveUsers = await login.find({ status: false }, '-password');
        res.status(200).json({
            status: true,
            message: 'Inactive users retrieved successfully',
            data: inactiveUsers
        });
    } catch (error) {
        console.error('Error retrieving inactive users:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.put('/v1/admin/user/:id/activate', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await login.findById(id);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }
        user.status = true;
        await user.save();
        res.status(200).json({
            status: true,
            message: 'User activated successfully',
        });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.put('/v1/admin/user/:id/deactivate', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await login.findById(id);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }
        user.status = false;
        await user.save();
        res.status(200).json({
            status: true,
            message: 'User deactivated successfully',
        });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
    });
}
});

router.get('/v1/admin/bookingpdf', isAdmin, async (req, res) => {
    try {
        // Get all categories and all bookings
        const categories = await Category.find();
        const bookings = await require('../../../models/booking').find().populate('category user');

        // Prepare summary table for categories
        const categoryTable = [
            [
                { text: 'Category', bold: true },
                { text: 'Total Rooms', bold: true },
                { text: 'Rooms Booked', bold: true },
                { text: 'Rooms Available', bold: true },
                { text: 'Price/Room', bold: true }
            ]
        ];

        for (const cat of categories) {
            // Calculate rooms booked for this category
            const booked = bookings
                .filter(b => b.category && b.category._id.toString() === cat._id.toString())
                .reduce((sum, b) => sum + (b.noofroomsbooked || 0), 0);
            const totalRooms = (cat.isavailable || 0) + booked;
            categoryTable.push([
                cat.categoryname,
                totalRooms,
                booked,
                cat.isavailable,
                cat.price
            ]);
        }

        // Prepare bookings table
        const bookingTable = [
            [
                { text: 'User', bold: true },
                { text: 'Category', bold: true },
                { text: 'Rooms', bold: true },
                { text: 'Check-In', bold: true },
                { text: 'Check-Out', bold: true },
                { text: 'Amount', bold: true },
                { text: 'Status', bold: true },
                { text: 'Booked At', bold: true }
            ]
        ];
        bookings.forEach(b => {
            // Convert dates to IST (Indian Standard Time, UTC+5:30)
            function toIST(date) {
                if (!date) return '';
                const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
                const istDate = new Date(new Date(date).getTime() + istOffset);
                return istDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            }

            bookingTable.push([
                b.user ? b.user.name : '',
                b.category ? b.category.categoryname : '',
                b.noofroomsbooked,
                b.checkInDate ? toIST(b.checkInDate).split(',')[0] : '',
                b.checkOutDate ? toIST(b.checkOutDate).split(',')[0] : '',
                b.totalAmount,
                b.status ? 'Active' : 'Inactive',
                b.createdAt ? toIST(b.createdAt).split(',')[0] : ''
            ]);
        });

        // PDF document definition
        const docDefinition = {
            content: [
            { text: 'Booking Status Report', style: 'header', alignment: 'center' },
            { text: '\nCategory Summary', style: 'subheader', alignment: 'left' },
            {
                table: {
                headerRows: 1,
                widths: [100, 60, 60, 60, 60],
                body: categoryTable
                },
                layout: {
                fillColor: function (rowIndex) {
                    return rowIndex === 0 ? '#eeeeee' : null;
                }
                }
            },
            { text: '\nAll Bookings', style: 'subheader', alignment: 'left' },
            {
                table: {
                headerRows: 1,
                widths: [60, 60, 40, 60, 60, 60, 50, 70],
                body: bookingTable
                },
                layout: {
                fillColor: function (rowIndex) {
                    return rowIndex === 0 ? '#eeeeee' : null;
                }
                }
            }
            ],
            styles: {
            header: {
                fontSize: 20,
                bold: true,
                margin: [0, 0, 0, 10],
                alignment: 'center'
            },
            subheader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5],
                alignment: 'left'
            }
            },
            defaultStyle: {
            font: 'Helvetica'
            }
        };

        // Use built-in Helvetica font
        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };

        const PdfPrinter = require('pdfmake');

        const printer = new PdfPrinter(fonts);

        // Generate PDF as Buffer and stream to response
        const chunks = [];
        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', async () => {
            const pdfBuffer = Buffer.concat(chunks);

            // Send email to admin
            const adminUser = await login.findOne({ role: 'admin' });
            if (adminUser && adminUser.email) {
                await sendTextEmail(
                    adminUser.email,
                    'Booking Status Report PDF',
                    'Please find attached the latest booking status report.',
                    null,
                    [
                        {
                            filename: 'booking_status_report.pdf',
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                );
            }

            // Send PDF to Postman
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="booking_status_report.pdf"');
            res.send(pdfBuffer);
        });

        pdfDoc.end();
    } catch (error) {
        console.error('Error generating booking status PDF:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/user/:id/pdf', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await login.findById(id, '-password');
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }
        const Booking = await require('../../../models/booking');
        // Get all bookings for this user
        const bookings = await Booking.find({ user: id })
            .populate('category')
            .sort({ createdAt: -1 });

        // User details section
        const userDetails = [
            { text: 'User Details', style: 'header', alignment: 'center' },
            {
                table: {
                    widths: [120, '*'],
                    body: [
                        [{ text: 'Name', bold: true }, user.name || ''],
                        [{ text: 'Email', bold: true }, user.email || ''],
                        [{ text: 'Phone', bold: true }, user.phoneno ? user.phoneno.toString() : ''],
                        [{ text: 'Role', bold: true }, user.role || ''],
                        [{ text: 'Status', bold: true }, user.status ? 'Active' : 'Inactive'],
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            }
        ];

        // Bookings table
        const bookingTable = [
            [
                { text: 'Category', bold: true },
                { text: 'Rooms', bold: true },
                { text: 'Check-In', bold: true },
                { text: 'Check-Out', bold: true },
                { text: 'Amount', bold: true },
                { text: 'Status', bold: true },
                { text: 'Booked At', bold: true }
            ]
        ];

        function toIST(date) {
            if (!date) return '';
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(new Date(date).getTime() + istOffset);
            return istDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }

        bookings.forEach(b => {
            bookingTable.push([
                b.category ? b.category.categoryname : '',
                b.noofroomsbooked,
                b.checkInDate ? toIST(b.checkInDate).split(',')[0] : '',
                b.checkOutDate ? toIST(b.checkOutDate).split(',')[0] : '',
                b.totalAmount,
                b.status ? 'Active' : 'Inactive',
                b.createdAt ? toIST(b.createdAt) : ''
            ]);
        });

        const docDefinition = {
            content: [
                ...userDetails,
                { text: 'Booking History', style: 'subheader', alignment: 'left', margin: [0, 10, 0, 5] },
                bookings.length === 0
                    ? { text: 'No bookings found for this user.', italics: true }
                    : {
                        table: {
                            headerRows: 1,
                            widths: [80, 40, 60, 60, 60, 50, 70],
                            body: bookingTable
                        },
                        layout: {
                            fillColor: function (rowIndex) {
                                return rowIndex === 0 ? '#eeeeee' : null;
                            }
                        }
                    }
            ],
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                subheader: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 10, 0, 5]
                }
            },
            defaultStyle: {
                font: 'Helvetica'
            }
        };

        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };
        const PdfPrinter = require('pdfmake');
        const printer = new PdfPrinter(fonts);

        const chunks = [];
        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', async () => {
            const pdfBuffer = Buffer.concat(chunks);

            // Optionally email to admin
            const adminUser = await login.findOne({ role: 'admin' });
            if (adminUser && adminUser.email) {
                await sendTextEmail(
                    adminUser.email,
                    `User Details PDF: ${user.name}`,
                    `Please find attached the details and booking history for user: ${user.name} (${user.email})`,
                    null,
                    [
                        {
                            filename: `user_${user._id}_details.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                );
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="user_${user._id}_details.pdf"`);
            res.send(pdfBuffer);
        });

        pdfDoc.end();
    } catch (error) {
        console.error('Error generating user PDF:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');


router.get('/v1/admin/bookingstats/email', isAdmin, async (req, res) => {
    try {
        const Booking = require('../../../models/booking');
        const categories = await Category.find({ status: true });
        const bookings = await Booking.find({}).populate('category');

        // Count bookings per category
        const categoryCounts = {};
        categories.forEach(cat => {
            categoryCounts[cat.categoryname] = 0;
        });
        bookings.forEach(b => {
            if (b.category && b.category.categoryname) {
                categoryCounts[b.category.categoryname] = (categoryCounts[b.category.categoryname] || 0) + 1;
            }
        });

        // Prepare data for pie chart
        const labels = Object.keys(categoryCounts);
        const values = Object.values(categoryCounts);

        // Generate a visually stunning pie chart image
        const width = 800;
        const height = 600;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#f8fafc' });

        // Generate a beautiful color palette for up to 12 categories
        const palette = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#00C49A', '#FF6F91', '#845EC2', '#FFC75F', '#F9F871', '#0081CF'
        ];
        // If more categories, repeat palette
        const backgroundColor = labels.map((_, i) => palette[i % palette.length]);

        const configuration = {
            type: 'pie',
            data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColor,
                borderColor: '#fff',
                borderWidth: 4,
                hoverOffset: 24,
            }]
            },
            options: {
            plugins: {
                title: {
                display: true,
                text: 'Booking Distribution by Category',
                font: {
                    size: 32,
                    weight: 'bold',
                    family: 'Arial'
                },
                color: '#222',
                padding: { top: 30, bottom: 30 }
                },
                legend: {
                display: true,
                position: 'right',
                labels: {
                    font: {
                    size: 18,
                    family: 'Arial'
                    },
                    color: '#333',
                    padding: 24,
                    boxWidth: 32,
                    boxHeight: 18
                }
                },
                tooltip: {
                enabled: true,
                backgroundColor: '#fff',
                titleColor: '#222',
                bodyColor: '#222',
                borderColor: '#888',
                borderWidth: 2,
                padding: 16,
                caretSize: 10,
                cornerRadius: 10,
                callbacks: {
                    label: function(context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percent = total ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${percent}%)`;
                    }
                }
                },
                datalabels: {
                display: true,
                color: '#222',
                font: {
                    weight: 'bold',
                    size: 18
                },
                formatter: (value, ctx) => {
                    const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const percent = total ? ((value / total) * 100).toFixed(1) : 0;
                    return percent > 5 ? `${percent}%` : '';
                }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1800,
                easing: 'easeOutBounce'
            },
            layout: {
                padding: {
                left: 40,
                right: 40,
                top: 40,
                bottom: 40
                }
            }
            },
            
        };

        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

        // Send email to admin
        const adminUser = await login.findOne({ role: 'admin' });
        if (adminUser && adminUser.email) {
            await sendTextEmail(
                adminUser.email,
                'Booking Stats Pie Chart',
                'Please find attached the latest booking statistics pie chart.',
                `<p>See attached pie chart for booking distribution by category.</p>`,
                [
                    {
                        filename: 'booking_stats_pie_chart.png',
                        content: imageBuffer,
                        contentType: 'image/png'
                    }
                ]
            );
        }

        res.status(200).json({
            status: true,
            message: 'Pie chart sent to admin email successfully'
        });
    } catch (error) {
        console.error('Error sending booking stats pie chart:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/admin/bookingstats/bar', isAdmin, async (req, res) => {
    try {
        const Booking = require('../../../models/booking');
        const categories = await Category.find({ status: true });
        const bookings = await Booking.find({}).populate('category');

        // Helper functions
        function formatDate(date) {
            return date.toISOString().split('T')[0];
        }
        function getMonthYear(date) {
            const d = new Date(date);
            return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        function getYear(date) {
            return new Date(date).getFullYear().toString();
        }

        // Prepare stats
        const today = formatDate(new Date());
        const thisMonth = getMonthYear(new Date());
        const thisYear = getYear(new Date());

        // Booking counts
        let totalDay = 0, totalMonth = 0, totalYear = 0;
        let dayCounts = {}, monthCounts = {}, yearCounts = {};
        let categoryDay = {}, categoryMonth = {}, categoryYear = {};

        categories.forEach(cat => {
            categoryDay[cat.categoryname] = 0;
            categoryMonth[cat.categoryname] = 0;
            categoryYear[cat.categoryname] = 0;
        });

        bookings.forEach(b => {
            if (!b.category) return;
            const catName = b.category.categoryname;
            const bookDate = b.createdAt || b.updatedAt || b.date || new Date();
            const d = formatDate(bookDate);
            const m = getMonthYear(bookDate);
            const y = getYear(bookDate);

            // Per day
            if (d === today) {
                totalDay++;
                categoryDay[catName] = (categoryDay[catName] || 0) + 1;
            }
            // Per month
            if (m === thisMonth) {
                totalMonth++;
                categoryMonth[catName] = (categoryMonth[catName] || 0) + 1;
            }
            // Per year
            if (y === thisYear) {
                totalYear++;
                categoryYear[catName] = (categoryYear[catName] || 0) + 1;
            }

            // For most booked
            dayCounts[d] = (dayCounts[d] || 0) + 1;
            monthCounts[m] = (monthCounts[m] || 0) + 1;
            yearCounts[y] = (yearCounts[y] || 0) + 1;
        });

        // Find most booked day/month/year
        function getMaxKey(obj) {
            return Object.entries(obj).reduce((max, curr) => curr[1] > max[1] ? curr : max, ['', 0]);
        }
        const [mostBookedDay, mostBookedDayCount] = getMaxKey(dayCounts);
        const [mostBookedMonth, mostBookedMonthCount] = getMaxKey(monthCounts);
        const [mostBookedYear, mostBookedYearCount] = getMaxKey(yearCounts);

        // Prepare bar chart data
        const labels = categories.map(c => c.categoryname);
        const barDataDay = labels.map(l => categoryDay[l] || 0);
        const barDataMonth = labels.map(l => categoryMonth[l] || 0);
        const barDataYear = labels.map(l => categoryYear[l] || 0);

        // Generate a beautiful bar chart image
        const width = 900, height = 500;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#f8fafc' });

        const datasets = [
            {
            label: 'Today',
            data: barDataDay,
            backgroundColor: 'rgba(54, 162, 235, 0.85)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
            categoryPercentage: 0.7
            },
            {
            label: 'This Month',
            data: barDataMonth,
            backgroundColor: 'rgba(255, 99, 132, 0.85)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
            categoryPercentage: 0.7
            },
            {
            label: 'This Year',
            data: barDataYear,
            backgroundColor: 'rgba(75, 192, 192, 0.85)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
            categoryPercentage: 0.7
            }
        ];

        const config = {
            type: 'bar',
            data: {
            labels: labels,
            datasets: datasets
            },
            options: {
            plugins: {
                title: {
                display: true,
                text: 'Bookings per Category (Day / Month / Year)',
                font: {
                    size: 26,
                    weight: 'bold',
                    family: 'Arial'
                },
                color: '#222',
                padding: { top: 20, bottom: 20 }
                },
                legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                    size: 16,
                    family: 'Arial'
                    },
                    color: '#333',
                    padding: 20
                }
                },
                tooltip: {
                enabled: true,
                backgroundColor: '#fff',
                titleColor: '#222',
                bodyColor: '#222',
                borderColor: '#888',
                borderWidth: 1,
                padding: 12,
                caretSize: 8,
                cornerRadius: 8
                }
            },
            responsive: false,
            layout: {
                padding: {
                left: 40,
                right: 40,
                top: 30,
                bottom: 30
                }
            },
            scales: {
                x: {
                stacked: true,
                grid: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Category',
                    font: {
                    size: 18,
                    weight: 'bold'
                    },
                    color: '#444'
                },
                ticks: {
                    font: {
                    size: 14
                    },
                    color: '#444'
                }
                },
                y: {
                beginAtZero: true,
                stacked: true,
                grid: {
                    color: '#e0e0e0'
                },
                title: {
                    display: true,
                    text: 'Bookings',
                    font: {
                    size: 18,
                    weight: 'bold'
                    },
                    color: '#444'
                },
                ticks: {
                    font: {
                    size: 14
                    },
                    color: '#444'
                }
                }
            }
            }
        };

        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(config);

        // Prepare text details
        let details = `
            <h2>Booking Statistics</h2>
            <ul>
                <li><b>Total bookings today:</b> ${totalDay}</li>
                <li><b>Total bookings this month:</b> ${totalMonth}</li>
                <li><b>Total bookings this year:</b> ${totalYear}</li>
                <li><b>Most booked day:</b> ${mostBookedDay} (${mostBookedDayCount} bookings)</li>
                <li><b>Most booked month:</b> ${mostBookedMonth} (${mostBookedMonthCount} bookings)</li>
                <li><b>Most booked year:</b> ${mostBookedYear} (${mostBookedYearCount} bookings)</li>
            </ul>
            <h3>Bookings per Category Today</h3>
            <ul>
                ${labels.map(l => `<li>${l}: ${categoryDay[l] || 0}</li>`).join('')}
            </ul>
            <h3>Bookings per Category This Month</h3>
            <ul>
                ${labels.map(l => `<li>${l}: ${categoryMonth[l] || 0}</li>`).join('')}
            </ul>
            <h3>Bookings per Category This Year</h3>
            <ul>
                ${labels.map(l => `<li>${l}: ${categoryYear[l] || 0}</li>`).join('')}
            </ul>
        `;

        // Send email to admin
        const adminUser = await login.findOne({ role: 'admin' });
        if (adminUser && adminUser.email) {
            await sendTextEmail(
                adminUser.email,
                'Booking Bar Graph & Stats',
                'See attached bar graph and booking statistics.',
                details,
                [
                    {
                        filename: 'booking_stats_bar_chart.png',
                        content: imageBuffer,
                        contentType: 'image/png'
                    }
                ]
            );
        }

        res.status(200).json({
            status: true,
            message: 'Bar graph and booking stats sent to admin email successfully',
            stats: {
                totalDay,
                totalMonth,
                totalYear,
                mostBookedDay: { date: mostBookedDay, count: mostBookedDayCount },
                mostBookedMonth: { month: mostBookedMonth, count: mostBookedMonthCount },
                mostBookedYear: { year: mostBookedYear, count: mostBookedYearCount },
                categoryDay,
                categoryMonth,
                categoryYear
            }
        });
    } catch (error) {
        console.error('Error sending booking stats bar chart:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});


module.exports=router;