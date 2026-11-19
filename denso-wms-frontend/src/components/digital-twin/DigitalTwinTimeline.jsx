// DigitalTwinTimeline.jsx
// Interactive Playback Timeline: Play, Pause, Speed 1x/2x/4x, Event Scrubbing & Kinematic Phase Displays.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, FastForward, SkipBack, SkipForward, Clock } from 'lucide-react';

export default function DigitalTwinTimeline({
  isPlaying = false,
  onTogglePlay,
  progress = 0, // 0 to 1
  onSeek,
  speed = 1,
  onChangeSpeed,
  onReset,
  phaseText = '',
  activeEvent = null,
  eventsList = [],
  onSelectEvent
}) {
  const percentage = Math.round(progress * 100);

  return (
    <div className="p-3 bg-[#0C1625]/95 border-t border-[#1A2C42] backdrop-blur-md flex flex-col gap-2">
      {/* Top Line: Playback Buttons, Scrubber & Kinematics Phase */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={onTogglePlay}
            className={`font-semibold ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
            } text-white`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
            {isPlaying ? 'Tạm dừng' : 'Phát mô phỏng'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            className="border-[#26374C] bg-[#111E30] text-slate-300"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 ml-2 text-slate-400">
            <span className="text-[11px]">Tốc độ:</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                  speed === s
                    ? 'bg-[#10B981] text-slate-950 font-bold'
                    : 'bg-[#111E30] text-slate-400 hover:text-white border border-[#26374C]'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Current Kinematic Status / Phase Description */}
        <div className="flex-1 min-w-[280px] max-w-xl px-3 py-1.5 rounded-lg bg-[#080F1C] border border-[#1A2C42] text-slate-300 flex items-center justify-between">
          <span className="text-slate-400 font-mono text-[11px]">TRẠNG THÁI:</span>
          <span className="font-medium text-emerald-400 truncate ml-2">
            {phaseText || 'Sẵn sàng vận hành'}
          </span>
          <span className="ml-2 px-1.5 py-0.5 rounded bg-[#111E30] text-cyan-400 font-mono text-[11px]">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Scrubber Range Slider */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-slate-500">0%</span>
        <input
          aria-label="Tua dòng thời gian mô phỏng"
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => onSeek(Number(e.target.value) / 100)}
          className="flex-1 h-1.5 rounded-lg bg-[#111E30] accent-[#10B981] cursor-pointer"
        />
        <span className="text-[11px] font-mono text-slate-500">100%</span>
      </div>

      {/* Historical Event Sequence Strip (in REPLAY or Live Multi-Event mode) */}
      {eventsList.length > 0 && (
        <div className="pt-2 border-t border-[#1A2C42]/50">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-400 font-mono shrink-0 mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" />
              SỰ KIỆN GHI NHẬN:
            </span>
            {eventsList.slice(0, 10).map((ev, i) => (
              <button
                key={ev.id || i}
                onClick={() => onSelectEvent?.(ev)}
                className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-mono border text-left transition-colors ${
                  activeEvent?.id === ev.id
                    ? 'border-[#10B981] bg-[#10B981]/20 text-[#10B981] font-bold shadow'
                    : 'border-[#1A2C42] bg-[#111E30] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="block truncate max-w-[130px]">{ev.label}</span>
                <span className="block text-[10px] text-slate-500">{ev.source?.rackName || 'DOCK'} → {ev.destination?.rackName || 'R01'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
