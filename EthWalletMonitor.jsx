import React, { useState, useEffect } from 'react';
import { Bell, Wallet, TrendingUp, TrendingDown, AlertCircle, RefreshCw, Search, DollarSign, Activity } from 'lucide-react';

const EthWalletMonitor = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [monitoredWallets, setMonitoredWallets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('monitor');
  
  // Alert thresholds
  const [thresholds, setThresholds] = useState({
    minTxValue: 1, // ETH
    maxTxValue: 100, // ETH
    alertOnAnyTx: true
  });

  const addWallet = async () => {
    if (!walletAddress || !apiKey) {
      alert('Please enter both wallet address and API key');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchWalletData(walletAddress, apiKey);
      const newWallet = {
        address: walletAddress,
        balance: data.balance,
        txCount: data.txCount,
        lastChecked: new Date().toISOString(),
        transactions: data.transactions
      };
      
      setMonitoredWallets([...monitoredWallets, newWallet]);
      setWalletAddress('');
      
      addAlert({
        type: 'success',
        message: `Wallet ${shortenAddress(walletAddress)} added to monitoring`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      addAlert({
        type: 'error',
        message: `Failed to add wallet: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
    setLoading(false);
  };

  const fetchWalletData = async (address, key) => {
    // Fetch balance
    const balanceRes = await fetch(
      `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${key}`
    );
    const balanceData = await balanceRes.json();
    
    if (balanceData.status !== '1') {
      throw new Error(balanceData.message || 'Failed to fetch balance');
    }

    // Fetch transactions
    const txRes = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${key}`
    );
    const txData = await txRes.json();
    
    if (txData.status !== '1') {
      throw new Error(txData.message || 'Failed to fetch transactions');
    }

    return {
      balance: (parseInt(balanceData.result) / 1e18).toFixed(4),
      txCount: txData.result.length,
      transactions: txData.result
    };
  };

  const refreshWallet = async (index) => {
    setLoading(true);
    try {
      const wallet = monitoredWallets[index];
      const data = await fetchWalletData(wallet.address, apiKey);
      
      const updatedWallets = [...monitoredWallets];
      const oldBalance = parseFloat(wallet.balance);
      const newBalance = parseFloat(data.balance);
      
      // Check for balance changes
      if (oldBalance !== newBalance) {
        const change = newBalance - oldBalance;
        addAlert({
          type: change > 0 ? 'success' : 'warning',
          message: `Balance ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(4)} ETH for ${shortenAddress(wallet.address)}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check for new transactions
      if (data.txCount > wallet.txCount) {
        const newTxs = data.transactions.slice(0, data.txCount - wallet.txCount);
        newTxs.forEach(tx => {
          const value = parseFloat((parseInt(tx.value) / 1e18).toFixed(4));
          if (thresholds.alertOnAnyTx || 
              (value >= thresholds.minTxValue && value <= thresholds.maxTxValue)) {
            addAlert({
              type: 'info',
              message: `New transaction: ${value} ETH ${tx.from.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'}`,
              timestamp: new Date().toISOString(),
              txHash: tx.hash
            });
          }
        });
      }
      
      updatedWallets[index] = {
        ...wallet,
        balance: data.balance,
        txCount: data.txCount,
        transactions: data.transactions,
        lastChecked: new Date().toISOString()
      };
      
      setMonitoredWallets(updatedWallets);
    } catch (error) {
      addAlert({
        type: 'error',
        message: `Failed to refresh wallet: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
    setLoading(false);
  };

  const removeWallet = (index) => {
    const removed = monitoredWallets[index];
    setMonitoredWallets(monitoredWallets.filter((_, i) => i !== index));
    addAlert({
      type: 'info',
      message: `Removed ${shortenAddress(removed.address)} from monitoring`,
      timestamp: new Date().toISOString()
    });
  };

  const addAlert = (alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50));
  };

  const shortenAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getAlertColor = (type) => {
    switch(type) {
      case 'success': return 'bg-green-100 border-green-500 text-green-800';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'error': return 'bg-red-100 border-red-500 text-red-800';
      default: return 'bg-blue-100 border-blue-500 text-blue-800';
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (monitoredWallets.length > 0 && apiKey) {
      const interval = setInterval(() => {
        monitoredWallets.forEach((_, index) => {
          refreshWallet(index);
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [monitoredWallets, apiKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold">Ethereum Wallet Monitor</h1>
          </div>
          <p className="text-gray-400">Real-time monitoring and alerts for Ethereum wallet activities</p>
        </div>

        {/* API Key Input */}
        {!apiKey && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-2">API Key Required</p>
                <p className="text-sm text-gray-300 mb-3">Get your free API key from <a href="https://etherscan.io/apis" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Etherscan</a></p>
                <input
                  type="text"
                  placeholder="Enter your Etherscan API key"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'monitor' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
            }`}
          >
            <Wallet className="w-4 h-4 inline mr-2" />
            Monitor Wallets
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              activeTab === 'alerts' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Alerts
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'settings' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Monitor Tab */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* Add Wallet Form */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">Add Wallet to Monitor</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter Ethereum wallet address (0x...)"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={addWallet}
                  disabled={loading || !apiKey}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {loading ? 'Adding...' : 'Add Wallet'}
                </button>
              </div>
            </div>

            {/* Monitored Wallets */}
            <div className="grid gap-4">
              {monitoredWallets.map((wallet, index) => (
                <div key={index} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-5 h-5 text-purple-400" />
                        <code className="text-sm font-mono">{wallet.address}</code>
                      </div>
                      <p className="text-xs text-gray-400">Last checked: {formatTime(wallet.lastChecked)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => refreshWallet(index)}
                        disabled={loading}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => removeWallet(index)}
                        className="p-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-gray-400">Balance</span>
                      </div>
                      <p className="text-2xl font-bold">{wallet.balance} ETH</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Transactions</span>
                      </div>
                      <p className="text-2xl font-bold">{wallet.txCount}</p>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  {wallet.transactions && wallet.transactions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-gray-400">Recent Transactions</h3>
                      <div className="space-y-2">
                        {wallet.transactions.slice(0, 3).map((tx, txIndex) => {
                          const value = (parseInt(tx.value) / 1e18).toFixed(4);
                          const isOutgoing = tx.from.toLowerCase() === wallet.address.toLowerCase();
                          return (
                            <div key={txIndex} className="bg-slate-900 rounded p-3 text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {isOutgoing ? (
                                    <TrendingDown className="w-4 h-4 text-red-400" />
                                  ) : (
                                    <TrendingUp className="w-4 h-4 text-green-400" />
                                  )}
                                  <span className={isOutgoing ? 'text-red-400' : 'text-green-400'}>
                                    {isOutgoing ? 'Sent' : 'Received'}
                                  </span>
                                </div>
                                <span className="font-mono font-bold">{value} ETH</span>
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                {tx.hash.slice(0, 20)}...
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {monitoredWallets.length === 0 && (
                <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
                  <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No wallets being monitored yet</p>
                  <p className="text-sm text-gray-500 mt-2">Add a wallet address above to start monitoring</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className={`rounded-lg p-4 border-l-4 ${getAlertColor(alert.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    {alert.txHash && (
                      <a 
                        href={`https://etherscan.io/tx/${alert.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono hover:underline mt-1 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                  <span className="text-xs opacity-75 ml-4">{formatTime(alert.timestamp)}</span>
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
                <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No alerts yet</p>
                <p className="text-sm text-gray-500 mt-2">Alerts will appear here when wallet activity is detected</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-6">Alert Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={thresholds.alertOnAnyTx}
                    onChange={(e) => setThresholds({...thresholds, alertOnAnyTx: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Alert on any transaction</span>
                </label>
              </div>

              {!thresholds.alertOnAnyTx && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Minimum Transaction Value (ETH)
                    </label>
                    <input
                      type="number"
                      value={thresholds.minTxValue}
                      onChange={(e) => setThresholds({...thresholds, minTxValue: parseFloat(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Maximum Transaction Value (ETH)
                    </label>
                    <input
                      type="number"
                      value={thresholds.maxTxValue}
                      onChange={(e) => setThresholds({...thresholds, maxTxValue: parseFloat(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2"
                      step="0.1"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-slate-700">
                <h3 className="font-semibold mb-2">Auto-Refresh</h3>
                <p className="text-sm text-gray-400">Wallets are automatically refreshed every 30 seconds</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EthWalletMonitor;