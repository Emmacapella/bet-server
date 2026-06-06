const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const users = {
  "TRIAL_KEY_001": { betCount: 0, totalWins: 0, totalPnL: 0, baseBet: 0.0001, maxBets: 200 }
};

app.post('/api/next-bet', (req, res) => {
  const { key, lastResult, lastProfit, lastBet } = req.body;
  const user = users[key];

  if (!user) {
    return res.status(401).json({ error: "Invalid License Key." });
  }

  // 2. Process the previous bet's outcome
  if (lastResult === "win") {
    user.totalWins += lastProfit;
    user.totalPnL += lastProfit;
  } else if (lastResult === "loss") {
    user.totalPnL -= lastBet; 
  }

  // 3. Check Trial Limit
  if (user.betCount >= user.maxBets) {
    return res.json({ expired: true, message: "Trial limit of 200 bets reached." });
  }

  // 4. Calculate the NEXT bet to recover 50% of the total loss
  let currentBet = user.baseBet;
  if (user.totalPnL < 0) {
    currentBet = Math.abs(user.totalPnL) * 0.5; 
  }
  
  if (currentBet < user.baseBet) {
    currentBet = user.baseBet;
  }

  // Calculate random target between 3 and 8
  const rawTarget = (Math.random() * 5) + 3;
  const currentPayout = (rawTarget * 0.98).toFixed(2);

  user.betCount++;

  res.json({
    expired: false,
    betAmount: Number(currentBet.toFixed(4)),
    targetPayout: currentPayout,
    pnl: user.totalPnL,
    wins: user.totalWins,
    betsRemaining: user.maxBets - user.betCount
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
