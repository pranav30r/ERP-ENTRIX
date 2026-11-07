import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatNumber } from '../../lib/format';

interface DemandChartProps {
  data: Array<{ day: string; demand: number; safety: number }>;
}

export const DemandChart: React.FC<DemandChartProps> = ({ data }) => {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#635bff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#635bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            tickFormatter={(val) => formatNumber(val)}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
            formatter={(val: any) => [formatNumber(Number(val)) + ' units', 'Projected Demand']}
          />
          <Area type="monotone" dataKey="demand" stroke="#635bff" strokeWidth={2} fillOpacity={1} fill="url(#colorDemand)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DemandChart;
