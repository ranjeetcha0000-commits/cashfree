// server.js

// 1. ज़रूरी मॉड्यूल इम्पोर्ट करें
require('dotenv').config(); // .env फ़ाइल से वैरिएबल लोड करें
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. Express ऐप सेटअप करें
const app = express();
const port = process.env.PORT || 3000; // .env से पोर्ट लें या डिफ़ॉल्ट 3000

// 3. मिडलवेयर (Middleware)
app.use(cors()); // CORS इनेबल करें (ताकि HTML पेज इसे कॉल कर सके)
app.use(express.json()); // आने वाले JSON रिक्वेस्ट बॉडी को पार्स करें

// 4. Cashfree API कॉन्फ़िगरेशन (environment variables से)
const cashfreeConfig = {
    apiUrl: process.env.CASHFREE_API_URL,
    clientId: process.env.CASHFREE_CLIENT_ID,
    clientSecret: process.env.CASHFREE_CLIENT_SECRET,
    apiVersion: process.env.CASHFREE_API_VERSION
};

// --- API Endpoints ---

// रूट Endpoint (सर्वर चल रहा है या नहीं, यह जांचने के लिए)
app.get('/', (req, res) => {
    res.send('Cashfree Backend Server is running!');
});

// Endpoint 1: पेमेंट सेशन बनाने के लिए (HTML पेज इसे कॉल करेगा)
app.post('/create-payment-session', async (req, res) => {
    console.log("Received request to create payment session:", req.body); // रिक्वेस्ट लॉग करें

    // ज़रूरी: जाँचें कि Cashfree Keys .env में हैं या नहीं
    if (!cashfreeConfig.clientId || !cashfreeConfig.clientSecret) {
        console.error("Cashfree Client ID or Secret Key is missing in .env file.");
        return res.status(500).json({ status: "ERROR", message: "Server configuration error." });
    }

    try {
        const orderData = req.body.data; // HTML से भेजा गया डेटा

        if (!orderData || !orderData.amount || !orderData.customer_details) {
            return res.status(400).json({ status: "ERROR", message: "Missing required order data." });
        }

        const orderId = `DFD${Date.now()}`; // यूनिक ऑर्डर ID बनाएँ
        const cashfreeApiUrl = `${cashfreeConfig.apiUrl}/orders`;

        const payload = {
            order_id: orderId,
            order_amount: orderData.amount,
            order_currency: "INR",
            customer_details: orderData.customer_details,
            order_note: `Payment for ${orderData.product_name || 'Product'}`,
            order_tags: { // यह जानकारी Webhook में वापस मिलेगी
                full_address: orderData.full_address,
                payment_method: orderData.payment_method,
                amount_paid_now: String(orderData.amount_paid),
                amount_remaining: String(orderData.amount_remaining),
                total_amount: String(orderData.total_amount),
                product_name: orderData.product_name
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            'x-api-version': cashfreeConfig.apiVersion,
            'x-client-id': cashfreeConfig.clientId,
            'x-client-secret': cashfreeConfig.clientSecret
        };

        console.log("Sending payload to Cashfree:", payload);

        // Cashfree API को कॉल करें
        const response = await axios.post(cashfreeApiUrl, payload, { headers });

        console.log("Cashfree API Response:", response.data);

        // सफल प्रतिक्रिया को HTML पेज पर वापस भेजें
        res.status(200).json({
            status: "OK",
            payment_session_id: response.data.payment_session_id,
            order_id: response.data.order_id
        });

    } catch (error) {
        console.error("Error creating Cashfree session:", error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            status: "ERROR",
            message: error.response?.data?.message || "Failed to create payment session."
        });
    }
});

// Endpoint 2: Cashfree Webhook प्राप्त करने के लिए
app.post('/webhook', (req, res) => {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));

    try {
        const webhookData = req.body.data;

        // ज़रूरी सुरक्षा: प्रोडक्शन में Webhook Signature को ज़रूर वेरिफाई करें!
        // const receivedSignature = req.headers['x-webhook-signature'];
        // const timestamp = req.headers['x-webhook-timestamp'];
        // const calculatedSignature = crypto.createHmac('sha256', cashfreeConfig.clientSecret)
        //     .update(timestamp + req.rawBody) // rawBody चाहिए होगा, express.json({ verify: ... }) इस्तेमाल करें
        //     .digest('base64');
        // if (calculatedSignature !== receivedSignature) {
        //     console.warn("Webhook signature mismatch!");
        //     return res.status(400).send("Invalid signature");
        // }
        // console.log("Webhook signature verified successfully.");


        // सफल पेमेंट को प्रोसेस करें
        if (webhookData && webhookData.payment && webhookData.payment.payment_status === "SUCCESS") {
            console.log("Processing successful payment webhook:");

            const order = webhookData.order;
            const payment = webhookData.payment;
            const customer = webhookData.customer;
            const tags = order.order_tags || {}; // हमने जो टैग्स सेव किए थे

            // यहाँ ऑर्डर डिटेल्स को डेटाबेस में सेव करने का लॉजिक लिखें
            console.log("--- Successful Order Details ---");
            console.log("Timestamp:", new Date(payment.payment_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
            console.log("Name:", customer.customer_name);
            console.log("Mobile:", customer.customer_phone);
            console.log("Email:", customer.customer_email); // Default email
            console.log("Address:", tags.full_address || "N/A");
            console.log("Product:", tags.product_name || "N/A");
            console.log("Method:", tags.payment_method || "N/A");
            console.log("Paid Now:", tags.amount_paid_now || order.order_amount);
            console.log("Remaining:", tags.amount_remaining || "0");
            console.log("Total:", tags.total_amount || order.order_amount);
            console.log("CF Payment ID:", payment.cf_payment_id);
            console.log("Status:", payment.payment_status);
            console.log("-------------------------------");

            // TODO: यहाँ डेटाबेस में सेव करें
        } else {
            console.log("Received webhook for non-successful payment or unknown event:", webhookData?.payment?.payment_status);
        }

        // Cashfree को तुरंत OK भेजें
        res.status(200).send('Webhook received successfully');

    } catch (error) {
        console.error("Error processing webhook:", error.message);
        res.status(500).send('Error processing webhook');
    }
});

// 5. सर्वर शुरू करें
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
    if (!cashfreeConfig.clientId || !cashfreeConfig.clientSecret) {
        console.warn("\x1b[33m%s\x1b[0m", "Warning: Cashfree Client ID or Secret Key is missing in .env file. API calls might fail."); // चेतावनी दिखाएँ
    }
});