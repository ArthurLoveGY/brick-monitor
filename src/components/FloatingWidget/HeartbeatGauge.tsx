import { useMemo } from 'react';
import { motion } from 'framer-motion';
import styles from './styles.module.css';

interface HeartbeatGaugeProps {
  codeRatio: number;
  talkRatio: number;
  bpm: number;
  status: 'Coding' | 'Talking' | 'Idle' | 'Balanced';
}

export function HeartbeatGauge({ codeRatio, talkRatio, bpm, status }: HeartbeatGaugeProps) {
  // 计算指针角度 (0-180度映射到 0-100%)
  const needleAngle = useMemo(() => {
    // 左边是 Talk (0-50)，右边是 Code (50-100)
    const ratio = codeRatio - talkRatio; // -100 到 100
    return (ratio + 100) / 200 * 180 - 90; // 转换为 -90 到 90 度
  }, [codeRatio, talkRatio]);

  const gaugeColor = useMemo(() => {
    switch (status) {
      case 'Coding': return '#10b981'; // 绿色
      case 'Talking': return '#f59e0b'; // 橙色
      case 'Idle': return '#6b7280'; // 灰色
      case 'Balanced': return '#3b82f6'; // 蓝色
    }
  }, [status]);

  // 心跳动画的脉冲效果
  const pulseScale = useMemo(() => {
    return 1 + (bpm - 40) / 200; // 40bpm = 1.0, 120bpm = 1.4
  }, [bpm]);

  return (
    <div className={styles.gaugeContainer}>
      {/* 仪表盘背景 */}
      <svg className={styles.gaugeSvg} viewBox="0 0 120 70">
        {/* 背景弧线 */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Talk 区域 (左半) */}
        <path
          d="M 10 60 A 50 50 0 0 1 60 10"
          fill="none"
          stroke="rgba(245, 158, 11, 0.3)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Code 区域 (右半) */}
        <path
          d="M 60 10 A 50 50 0 0 1 110 60"
          fill="none"
          stroke="rgba(16, 185, 129, 0.3)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* 当前进度弧线 */}
        <motion.path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(codeRatio / 100) * 157} 157`}
          initial={{ strokeDasharray: '0 157' }}
          animate={{ strokeDasharray: `${(codeRatio / 100) * 157} 157` }}
          transition={{ type: 'spring', stiffness: 50 }}
        />

        {/* 指针 */}
        <motion.g
          style={{ transformOrigin: '60px 60px' }}
          animate={{ rotate: needleAngle }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="20"
            stroke={gaugeColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="4" fill={gaugeColor} />
        </motion.g>

        {/* 刻度标签 */}
        <text x="10" y="70" className={styles.gaugeLabel}>Talk</text>
        <text x="100" y="70" className={styles.gaugeLabel}>Code</text>
      </svg>

      {/* 中心心跳图标 */}
      <motion.div
        className={styles.heartIcon}
        animate={{ scale: [1, pulseScale, 1] }}
        transition={{ duration: 60 / bpm, repeat: Infinity }}
      >
        ❤️
      </motion.div>
    </div>
  );
}
