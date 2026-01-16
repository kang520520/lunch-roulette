import { useState, useEffect, useRef } from 'react';
import './App.css'; // 確保有引入 CSS
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyCDjlWkGkh_T8IienOFH_sNWPA10qakPuM",
  authDomain: "lunch-roulette-ac4e3.firebaseapp.com",
  projectId: "lunch-roulette-ac4e3",
  storageBucket: "lunch-roulette-ac4e3.firebasestorage.app",
  messagingSenderId: "172864187145",
  appId: "1:172864187145:web:ecad4a9cd332c7a82cc1d8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULTS = {
  lunch: ["麥當勞", "肯德基", "便利商店", "健康餐", "牛肉麵", "水餃", "便當"],
  drink: ["50嵐", "可不可", "星巴克", "路易莎", "迷客夏", "白開水"]
};

const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#F473B9", "#845EC2", "#FF9671"];

function App() {
  const [currentMode, setCurrentMode] = useState('lunch');
  const [dataStore, setDataStore] = useState(DEFAULTS);
  const [options, setOptions] = useState([]); 
  const [newOption, setNewOption] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [modalResult, setModalResult] = useState(null);
  const [showToast, setShowToast] = useState(false);
  
  const canvasRef = useRef(null);
  const startAngleRef = useRef(0);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsub = onSnapshot(doc(db, 'lunch_roulette', 'public_list'), (docSnap) => {
      if (docSnap.exists()) {
        setDataStore(docSnap.data()); 
      } else {
        saveToCloud(DEFAULTS);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setOptions(dataStore[currentMode] || []);
  }, [dataStore, currentMode]);

  useEffect(() => {
    drawWheel();
  }, [options]);

  const saveToCloud = async (newData) => {
    try {
      await setDoc(doc(db, 'lunch_roulette', 'public_list'), newData, { merge: true });
    } catch (e) {
      // ignore
    }
  };

  const handleSwitchMode = (mode) => {
    if (currentMode === mode || isSpinning) return;
    setCurrentMode(mode);
  };

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const len = options.length;

    if (len === 0) { 
      ctx.clearRect(0, 0, 600, 600); 
      return; 
    }
    
    const arc = Math.PI * 2 / len;
    const centerX = 300;
    const centerY = 300;
    const radius = 300;
    const currentStartAngle = startAngleRef.current;

    ctx.clearRect(0, 0, 600, 600);
    ctx.font = 'bold 32px "Microsoft JhengHei", sans-serif';

    for (let i = 0; i < len; i++) {
      const angle = currentStartAngle + i * arc;
      
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arc, false);
      ctx.lineTo(centerX, centerY);
      ctx.fill();

      ctx.save();
      ctx.fillStyle = "white";
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
      
      ctx.translate(centerX + Math.cos(angle + arc / 2) * (radius * 0.65), 
                    centerY + Math.sin(angle + arc / 2) * (radius * 0.65));
      ctx.rotate(angle + arc / 2 + Math.PI / 2);
      
      const text = options[i];
      if (text.length > 6) ctx.font = 'bold 24px "Microsoft JhengHei"';
      else ctx.font = 'bold 32px "Microsoft JhengHei"';
      
      ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
      ctx.restore();
    }
  };

  const handleSpin = () => {
    if (isSpinning) return;
    if (options.length < 2) {
      alert("請至少輸入兩個選項才能轉喔！");
      return;
    }
    
    setIsSpinning(true);
    let spinTime = 0;
    let spinTimeTotal = Math.random() * 2000 + 3000; 
    let currentSpeed = Math.random() * 10 + 20;

    const animate = () => {
      spinTime += 20;
      if (spinTime < spinTimeTotal) {
        const progress = spinTime / spinTimeTotal;
        const speed = currentSpeed * (1 - Math.pow(progress, 3)); 
        const actualSpeed = speed < 0.5 ? 0.5 : speed;
        startAngleRef.current += (actualSpeed * Math.PI / 180);
        drawWheel();
        requestAnimationFrame(animate);
      } else {
        finishSpin();
      }
    };
    requestAnimationFrame(animate);
  };

  const finishSpin = () => {
    const arc = Math.PI * 2 / options.length;
    const degrees = startAngleRef.current * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) / arcd) % options.length;
    setModalResult(options[index]);
    setIsSpinning(false);
  };

  const handleAddOption = () => {
    const val = newOption.trim();
    if (val) {
      const newOptions = [...options, val];
      setOptions(newOptions);
      setNewOption('');
      const newDataStore = { ...dataStore, [currentMode]: newOptions };
      saveToCloud(newDataStore);
    }
  };

  const handleDeleteOption = (idx) => {
    const newOptions = [...options];
    newOptions.splice(idx, 1);
    setOptions(newOptions);
    const newDataStore = { ...dataStore, [currentMode]: newOptions };
    saveToCloud(newDataStore);
  };

  const handleShare = () => {
    const shareUrl = window.location.href.split('?')[0]; 
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        })
        .catch(() => prompt("請複製網址：", shareUrl));
    } else {
      prompt("請手動複製此網址分享：", shareUrl);
    }
  };

  return (
    <div className={`app-container mode-${currentMode}`}>
      {/* ▼▼▼ 這裡就是你要的右上角按鈕 ▼▼▼ */}
      <button className="btn-share-top" onClick={handleShare} title="複製連結">
        🔗
      </button>

      <div className="tabs">
        <button className={`tab-btn ${currentMode === 'lunch' ? 'active' : ''}`} onClick={() => handleSwitchMode('lunch')}>🍚 午餐</button>
        <button className={`tab-btn ${currentMode === 'drink' ? 'active' : ''}`} onClick={() => handleSwitchMode('drink')}>🥤 飲料</button>
      </div>

      <h1 id="pageTitle">{currentMode === 'lunch' ? '午餐吃什麼？' : '飲料喝哪家？'}</h1>
      <div className="subtitle">所有人的名單都已同步連線 ☁️</div>

      <div className="wheel-container">
        <div className="pointer"></div>
        <canvas ref={canvasRef} width="600" height="600"></canvas>
      </div>

      <button className="btn-spin" onClick={handleSpin} disabled={isSpinning}>
        {isSpinning ? "轉動中..." : "GO! 開始轉動"}
      </button>

      <div className="controls">
        <div className="input-wrapper">
          <input 
            type="text" 
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
            placeholder={currentMode === 'lunch' ? "輸入餐廳名稱..." : "輸入飲料店..."}
            autoComplete="off"
          />
          <button className="btn-action btn-add" onClick={handleAddOption}>新增</button>
        </div>
      </div>

      <div className="option-list">
        {options.map((opt, idx) => (
          <div key={`${opt}-${idx}`} className="tag" onClick={() => handleDeleteOption(idx)}>
            <span>{opt}</span>
            <span className="remove">✕</span>
          </div>
        ))}
      </div>

      {modalResult && (
        <div className="modal-overlay" onClick={() => setModalResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: '#666' }}>命運決定是...</h3>
            <div className="result-text">{modalResult}</div>
            <button className="btn-action btn-add" style={{ width: '100%', fontSize: '1.1rem' }} onClick={() => setModalResult(null)}>
              太棒了！
            </button>
          </div>
        </div>
      )}

      <div className={`toast ${showToast ? 'show' : ''}`}>✅ 連結已複製！</div>
    </div>
  );
}

export default App;