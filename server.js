require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS को सिक्योर करें - अपनी वेबसाइट का URL यहाँ डालें
app.use(cors({
    origin: ['https://www.suhanakart.in', 'http://127.0.0.1:5500'], // अपनी साइट को अनुमति दें
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Cashfree Live Config
const CF_CONFIG = {
    // लाइव के लिए यह URL होना चाहिए: https://api.cashfree.com/pg/orders
    url: process.env.CASHFREE_API_URL || "https://api.cashfree.com/pg/orders",
    clientId: process.env.CASHFREE_CLIENT_ID,
    secretKey: process.env.CASHFREE_CLIENT_SECRET,
    version: "2023-08-01"
};

// रूट चेक करने के लिए
app.get('/', (req, res) => res.send('Suhanakart Live API is Running...'));

app.post('/create-payment-session', async (req, res) => {
    try {
        const { data } = req.body;
        
        // 1. डेटा वैलिडेशन
        if (!data || !data.amount_paid || !data.customer_details) {
            return res.status(400).json({ status: "ERROR", message: "Missing required data" });
        }

        const orderId = "SKP" + Date.now();

        // 2. Thank You Page URL (Live)
        const thankYouUrl = `https://www.suhanakart.in/pages/thanku-page?orderId=${orderId}&pName=${encodeURIComponent(data.product_name_real)}&pImg=${encodeURIComponent(data.product_image_real)}&qty=${data.quantity}&paid=${data.amount_paid}&remain=${data.amount_remaining}&cName=${encodeURIComponent(data.customer_details.customer_name)}&cMobile=${data.customer_details.customer_phone}&addr=${encodeURIComponent(data.customer_details.address_line1)}`;

        const payload = {
            order_id: orderId,
            order_amount: parseFloat(data.amount_paid), // सुनिश्चित करें कि यह नंबर है
            order_currency: "INR",
            customer_details: {
                customer_id: "CUST" + data.customer_details.customer_phone,
                customer_phone: String(data.customer_details.customer_phone).slice(-10), // 10 अंकों का नंबर
                customer_name: data.customer_details.customer_name,
                customer_email: "order@suhanakart.in"
            },
            order_meta: {
                return_url: thankYouUrl
            },
            order_note: "AFFORTABLE WATCHES",
            order_tags: {
                real_product_name: data.product_name_real.substring(0, 50) // टैग्स की लिमिट होती है
            }
        };

        // 3. Cashfree API Call
        const response = await axios.post(CF_CONFIG.url, payload, {
            headers: {
                'x-client-id': CF_CONFIG.clientId,
                'x-client-secret': CF_CONFIG.secretKey,
                'x-api-version': CF_CONFIG.version,
                'Content-Type': 'application/json'
            }
        });

        // 4. सक्सेस रिस्पांस
        res.json({
            status: "OK",
            payment_session_id: response.data.payment_session_id,
            order_id: response.data.order_id
        });

    } catch (error) {
        // एरर डिटेल्स लॉग करें
        const errorData = error.response ? error.response.data : error.message;
        console.error("Cashfree Live Error:", JSON.stringify(errorData, null, 2));
        
        res.status(500).json({ 
            status: "ERROR", 
            message: error.response?.data?.message || "Payment session failed" 
        });
    }
});

app.listen(PORT, () => console.log(`Live Server running on port ${PORT}`));
