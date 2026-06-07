const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/api/next-bet', async (req, res) => {
  const { key, lastResult, lastProfit, lastBet, balance } = req.body;

  // 1. Fetch user/key record from Supabase
  let { data: user, error } = await supabase.from('keys').select('*').eq('key', key).single();
  if (error || !user) return res.status(401).json({ error: "Invalid License Key." });

  // 2. Dynamic Risk Management & Profit Target Calculation
  const parsedBalance = Number(balance) || 0;
  let dynamicBaseBet = parsedBalance * 0.001; // 0.1% of balance
  if (dynamicBaseBet <= 0) dynamicBaseBet = 0.0001; // Safety fallback floor

  // Profit target is strictly 10x the base bet (which equals 1% of their balance)
  const dynamicTargetProfit = dynamicBaseBet * 10;

  // 3. Check Expiry Conditions (Bet limit OR Dynamic Profit Target hit)
  if (user.bet_count >= user.max_bets) {
    return res.json({ expired: true, message: `Limit of ${user.max_bets} bets reached.` });
  }
  if (user.total_profit >= dynamicTargetProfit) {
    return res.json({ expired: true, message: `Target profit of ${dynamicTargetProfit.toFixed(6)} reached (10x base bet)!` });
  }

  // 4. Process the outcome & update PnL trackers
  let newPnL = user.total_pnl;
  let accumulatedProfit = user.total_profit || 0;

  if (lastResult === "win") {
    newPnL = 0; // Reset recovery tracker
    accumulatedProfit += lastProfit; // Add to overall session profit
  } else if (lastResult === "loss") {
    newPnL -= lastBet; // Accumulate recovery loss
    accumulatedProfit -= lastBet; // Deduct from overall session profit
  }

  // 5. Calculate the NEXT bet amount using the dynamic base bet
  let currentBet = dynamicBaseBet; 
  if (newPnL < 0) {
    currentBet = Math.abs(newPnL) * 0.5; 
  }
  if (currentBet < dynamicBaseBet) currentBet = dynamicBaseBet;

  const rawTarget = (Math.random() * 5) + 3;
  const currentPayout = (rawTarget * 0.98).toFixed(4); 

  const nextBetCount = user.bet_count + 1;
  
  // 6. Update tracking statistics and real-time balance fields inside Supabase
  await supabase.from('keys').update({ 
    bet_count: nextBetCount, 
    total_pnl: newPnL,
    total_profit: accumulatedProfit,
    balance: parsedBalance
  }).eq('key', key);

  // 7. Return response to your Tampermonkey script
  res.json({
    expired: false,
    betAmount: Number(currentBet.toFixed(6)), 
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
