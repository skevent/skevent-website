# SK Event Platform

A serverless full-stack event booking platform replicated with Vercel Functions, Supabase, and Razorpay.

## 🚀 Stack
- **Frontend**: Vanilla JS + Vite
- **Backend**: Vercel Serverless Functions (`api/`)
- **Database**: Supabase
- **Payments**: Razorpay
- **Email**: Resend

## 🛠️ Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Ensure you have a `.env` file with the following keys:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=...
   RAZORPAY_KEY_ID=...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   RESEND_API_KEY=...
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

3. **Run Locally**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend APIs: `http://localhost:5173/api/...` (Proxied via Vite)

## 🚢 Deployment

**Vercel** is recommended.

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy:
   ```bash
   vercel
   ```
3. **Environment Variables on Vercel**:
   Add the same variables from `.env` to your Vercel Project Settings.

## 💳 Razorpay Webhook
After deployment, configure the webhook in your Razorpay Dashboard:
- **Webhook URL**: `https://<your-project>.vercel.app/api/razorpay-webhook`
- **Secret**: Matches `RAZORPAY_WEBHOOK_SECRET`
- **Events**: `order.paid`

## 📂 Project Structure
- `/api`: Backend logic (Vercel Functions)
- `/admin`: Admin dashboard
- `/influencer`: Influencer dashboard
- `index.html`, `book.html`, etc.: Frontend pages
- `supabaseClient.js`: Frontend Supabase connection
