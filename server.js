require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Cashfree Config
const CF_CONFIG = {
    url: process.env.CASHFREE_API_URL || "https://sandbox.cashfree.com/pg/orders",
    clientId: process.env.CASHFREE_CLIENT_ID,
    secretKey: process.env.CASHFREE_CLIENT_SECRET,
    version: "2023-08-01"
};

app.post('/create-payment-session', async (req, res) => {
    try {
        const { data } = req.body;
        const orderId = "SKP" + Date.now();

        const payload = {
            order_id: orderId,
            order_amount: data.amount_paid,
            order_currency: "INR",
            customer_details: {
                customer_id: "CUST" + data.customer_details.customer_phone,
                customer_phone: data.customer_details.customer_phone,
                customer_name: data.customer_details.customer_name,
                customer_email: "order@suhanakart.in" // Default email
            },
            order_meta: {
                // यह Thank You पेज पर वापस जाने के लिए है
                return_url: `https://www.suhanakart.in/pages/thanku-page?orderId=${orderId}&pName=${encodeURIComponent(data.product_name_real)}&pImg=${encodeURIComponent(data.product_image_real)}&qty=${data.quantity}&paid=${data.amount_paid}&remain=${data.amount_remaining}&cName=${encodeURIComponent(data.customer_details.customer_name)}&cMobile=${data.customer_details.customer_phone}&addr=${encodeURIComponent(data.customer_details.address_line1)}`
            },
            order_note: "AFFORTABLE WATCHES", // यहाँ हमेशा यह नाम जाएगा
            order_tags: {
                real_product_name: data.product_name_real
            }
        };

        const response = await axios.post(CF_CONFIG.url, payload, {
            headers: {
                'x-client-id': CF_CONFIG.clientId,
                'x-client-secret': CF_CONFIG.secretKey,
                'x-api-version': CF_CONFIG.version,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            status: "OK",
            payment_session_id: response.data.payment_session_id,
            order_id: response.data.order_id
        });

    } catch (error) {
        console.error("Cashfree Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ status: "ERROR", message: "Session creation failed" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
