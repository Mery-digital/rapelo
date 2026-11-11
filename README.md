# 🔧 RAPELO

Mobile app (Expo / React Native + Supabase) for phone & computer repair shops.
Register a repair deposit, send the receipt by **WhatsApp** or **SMS**, and tell the customer when the device is ready, in one tap.

## Features
- **Atelier setup / login**: phone, password, workshop name, address (+ country code for WhatsApp). Saved on the phone (password stored as a SHA-256 hash only).
- **New deposit**: customer name, phone, device, problem, price (FCFA) → saved in `fiches_reparation` → WhatsApp / SMS opens with the confirmation message.
- **Live search**: filter by customer name or phone number.
- **Ongoing repairs**: cards with "📲 WhatsApp" / "💬 SMS Direct" buttons for the "ready" message (ticket becomes *Client prévenu*), plus "Le client a récupéré l'appareil" to close it.

## Setup
1. Install [Node.js LTS](https://nodejs.org).
2. In this folder:
   ```bash
   npm install
   npx expo install --fix    # aligns native package versions with your Expo SDK
   ```
3. Create a Supabase project, open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
4. Copy `.env.example` to `.env` and paste your project URL + anon key.
5. Start: `npx expo start`, then scan the QR code with **Expo Go**.

## Structure
```
App.js                      boot → setup/login → main
src/lib/supabase.js         Supabase client
src/lib/repairs.js          fetch / insert / update tickets
src/lib/messaging.js        messages, WhatsApp/SMS links, phone formatting
src/lib/storage.js          workshop profile (AsyncStorage)
src/screens/                SetupScreen, MainScreen, NewRepairScreen, RepairsListScreen
src/components/             Button, Field, RepairCard
```

## Phone numbers
WhatsApp needs the international format. Local numbers get the country code in front
(`0707070707` + `225` → `2250707070707`). Numbers typed with `+` or `00` are kept as is.
For countries where the leading `0` must be dropped (e.g. Nigeria, Ghana), type the customer number with `+`.

## ⚠️ Security
The SQL policies let anyone with the anon key read and write tickets; tickets are only separated by `atelier_tel`.
That's OK for a pilot. For production, use Supabase Auth (phone OTP or email), add an `owner uuid default auth.uid()` column,
and restrict policies with `using (owner = auth.uid())`.
