const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/api/next-bet', async (req, res) => {
  // Added 'balance' to the destructured body parameters
  const { key, lastResult, lastProfit, lastBet, balance } = req.body;

  let { data: user, error } = await supabase.from('keys').select('*').eq('key', key).single();
  if (error || !user) return res.status(401).json({ error: "Invalid License Key." });

  if (user.bet_count >= user.max_bets) {
    return res.json({ expired: true, message: `Limit of ${user.max_bets} bets reached.` });
  }
  if (user.total_profit >= user.target_profit) {
    return res.json({ expired: true, message: `Target profit of ${user.target_profit} reached!` });
  }

  let newPnL = user.total_pnl;
  let accumulatedProfit = user.total_profit || 0;

  if (lastResult === "win") {
    newPnL = 0; 
    accumulatedProfit += lastProfit; 
  } else if (lastResult === "loss") {
    newPnL -= lastBet; 
    accumulatedProfit -= lastBet; 
  }

  // DYNAMIC RISK MANAGEMENT: Base bet is strictly 0.1% of current balance
  const parsedBalance = Number(balance) || 0;
  let dynamicBaseBet = parsedBalance * 0.001; 
  if (dynamicBaseBet <= 0) dynamicBaseBet = 0.0001; // absolute safety floor fallback

  // Calculate the NEXT bet amount using the dynamic base bet
  let currentBet = dynamicBaseBet; 
  if (newPnL < 0) {
    currentBet = Math.abs(newPnL) * 0.5; 
  }
  
  // Ensure the bet does not accidentally drop below our calculated 0.1% floor
  if (currentBet < dynamicBaseBet) currentBet = dynamicBaseBet;

  const rawTarget = (Math.random() * 5) + 3;
  const currentPayout = (rawTarget * 0.98).toFixed(4); // Keep accuracy match

  const nextBetCount = user.bet_count + 1;
  await supabase.from('keys').update({ 
    bet_count: nextBetCount, 
    total_pnl: newPnL,
    total_profit: accumulatedProfit
  }).eq('key', key);

  res.json({
    expired: false,
    betAmount: Number(currentBet.toFixed(6)), // higher decimal precision for smaller balance ratios
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
