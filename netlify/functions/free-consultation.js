import nodemailer from "nodemailer";
import mongoose from "mongoose";

// Define schema
const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
  },
  { timestamps: true }
);

// Ensure unique booking per email + date
bookingSchema.index({ email: 1, date: 1 }, { unique: true });

// Use existing model or create new one (prevents "Cannot overwrite model" error)
const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Reusable CORS headers
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event, context) {
  // Handle preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URL);
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, company, email, phone, date, time } = body;

    // Validate all fields
    if (!name || !company || !email || !phone || !date || !time) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "All fields are required." }),
      };
    }

    // Save to database
    const newBooking = await Booking.create({
      name,
      company,
      email,
      phone,
      date,
      time,
    });

    // Email to Admin
    await transporter.sendMail({
      from: `"CloudMaSa Booking" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "New Free Consultation Booking",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="color: #0a1a44;">New Consultation Booking</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${company}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${date}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <p style="margin-top: 20px;">— CloudMaSa Team</p>
        </div>
      `,
    });

    // Email to User
    await transporter.sendMail({
      from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Free Consultation is Confirmed",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="color: #0a1a44;">Hello ${name},</h2>
          <p>Thank you for booking a free consultation with <strong>CloudMaSa</strong>.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li><strong>Company:</strong> ${company}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Time:</strong> ${time}</li>
            <li><strong>Phone:</strong> ${phone}</li>
          </ul>
          <p>We look forward to speaking with you and helping your business grow.</p>
          <p style="margin-top: 20px;">Best regards,<br><strong>CloudMaSa Team</strong></p>
        </div>
      `,
    });

    // Success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: "Consultation booked successfully!",
        bookingId: newBooking._id,
      }),
    };
  } catch (err) {
    console.error("Error in free-consultation function:", err);

    let message = "Server error. Please try again later.";
    if (err.code === 11000) {
      message = "You have already booked a consultation for this date.";
    } else if (err.name === "ValidationError") {
      message = "Invalid input data.";
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, message }),
    };
  } finally {
    // Optional: Close DB connection if needed (not required in Netlify, but safe)
    // await mongoose.connection.close();
  }
}
