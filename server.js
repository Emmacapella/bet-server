const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// A simple in-memory database. 
// In the future, replace this with MongoDB or Supabase so data survives server restarts.
const users = {
  "TRIAL_KEY_001": { betCount: 0, totalWins: 0, totalPnL: 0, baseBet: 0.15, maxBets: 200 }
};

app.post('/api/next-bet', (req, res) => {
  const { key, lastResult, lastProfit, lastBet } = req.body;
  const user = users[key];

  // 1. Validate User Key
  if (!user) {
    return res.status(401).json({ error: "Invalid License Key." });
  }

  // 2. Process the previous bet's outcome
  if (lastResult === "win") {
    user.totalWins += lastProfit;
    user.totalPnL += lastProfit;
  } else if (lastResult === "loss") {
    user.totalWins = 0; // Reset streak
    user.totalPnL -= lastBet;
  }

  // 3. Check Trial Limit
  if (user.betCount >= user.maxBets) {
    return res.json({ expired: true, message: "Trial limit of 200 bets reached." });
  }

  // 4. Calculate the NEXT bet using your secret 50% reverse logic
  let currentBet = user.baseBet;
  if (user.totalWins > 0) {
    currentBet = user.totalWins * 0.5;
  }
  if (currentBet < user.baseBet) {
    currentBet = user.baseBet;
  }

  // Calculate random target between 3 and 8
  const rawTarget = (Math.random() * 5) + 3;
  const currentPayout = (rawTarget * 0.98).toFixed(2);

  // Increment their bet counter
  user.betCount++;

  // Send the instructions back to the buyer's script
  res.json({
    expired: false,
    betAmount: currentBet,
    targetPayout: currentPayout,
    pnl: user.totalPnL,
    wins: user.totalWins,
    betsRemaining: user.maxBets - user.betCount
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
