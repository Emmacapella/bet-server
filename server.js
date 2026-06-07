const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Secure connection to Supabase via Render Environment Variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/api/next-bet', async (req, res) => {
  const { key, lastResult, lastProfit, lastBet } = req.body;

  // 1. Fetch user/key record from Supabase
  let { data: user, error } = await supabase.from('keys').select('*').eq('key', key).single();
  if (error || !user) return res.status(401).json({ error: "Invalid License Key." });

  // 2. Check Expiry/Trial Limit (Max 200 bets)
  if (user.bet_count >= user.max_bets) {
    return res.json({ expired: true, message: `Trial limit of ${user.max_bets} bets reached.` });
  }

  // 3. Process the outcome & update PnL
  let newPnL = user.total_pnl;
  if (lastResult === "win") {
    newPnL = 0; // Reset back to base bet tracking after a win
  } else if (lastResult === "loss") {
    newPnL -= lastBet; // Accumulate the loss
  }

  // 4. Calculate the NEXT bet amount based on your recovery math
  let currentBet = 0.0001; // Default baseBet
  if (newPnL < 0) {
    currentBet = Math.abs(newPnL) * 0.5; // Bet 50% of total loss to recover
  }
  if (currentBet < 0.0001) currentBet = 0.0001;

  // Calculate target payout multiplier
  const rawTarget = (Math.random() * 5) + 3;
  const currentPayout = (rawTarget * 0.98).toFixed(2);

  // 5. Update data back into Supabase
  const nextBetCount = user.bet_count + 1;
  await supabase.from('keys').update({ 
    bet_count: nextBetCount, 
    total_pnl: newPnL 
  }).eq('key', key);

  // 6. Return response to your Tampermonkey script
  res.json({
    expired: false,
    betAmount: Number(currentBet.toFixed(4)),
    targetPayout: currentPayout,
    pnl: newPnL,
    betsPlaced: nextBetCount,
    betsRemaining: user.max_bets - nextBetCount
  });
});
app.get('/', (req, res) => {
  res.send('ok');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
