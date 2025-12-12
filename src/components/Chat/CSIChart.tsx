import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface CSIPoint {
  date: string;
  avgCSI: number;
}

interface CSIDataset {
  label: string;
  color: string;
  values: number[];
}

interface CSIMultiSeries {
  labels: string[];
  series: CSIDataset[];
}

interface CSIChartProps {
  data?: CSIPoint[];
  title?: string;
  multiSeries?: CSIMultiSeries;
}

const CSIChart: React.FC<CSIChartProps> = ({ data, title, multiSeries }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 80; // chừa padding hai bên để không bị tràn
  const hasMulti = !!(multiSeries && multiSeries.series && multiSeries.series.length > 0);
  const hasSingle = !!(data && data.length > 0);
  const hasData = hasMulti || hasSingle;

  const effectivePoints: CSIPoint[] = hasSingle
    ? data!
    : [
        { date: '2025-01-01', avgCSI: -0.2 },
        { date: '2025-01-02', avgCSI: -0.1 },
        { date: '2025-01-03', avgCSI: 0.0 },
        { date: '2025-01-04', avgCSI: 0.1 },
        { date: '2025-01-05', avgCSI: 0.2 },
      ];

  const defaultLabels = effectivePoints.map((p) => {
    if (!p.date) return '';
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) {
      return p.date;
    }
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  });

  let chartLabels: string[];
  let chartDatasets: { data: number[]; color: (opacity?: number) => string; strokeWidth: number }[];

  if (hasMulti) {
    const rawLabels = multiSeries!.labels || [];
    const formatted = rawLabels.map((val) => {
      if (!val) return '';
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) {
        return String(val);
      }
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}`;
    });

    const targetCount = 5;
    const step = formatted.length > targetCount ? Math.floor(formatted.length / targetCount) || 1 : 1;
    chartLabels = formatted.map((lbl, idx) => (idx % step === 0 ? lbl : ''));
    chartDatasets = multiSeries!.series.map((s) => ({
      data: s.values,
      color: (opacity = 1) => s.color,
      strokeWidth: 2,
    }));
  } else {
    chartLabels = defaultLabels;
    chartDatasets = [
      {
        data: effectivePoints.map((p) => p.avgCSI),
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
    ];
  }

  if (hasData && chartLabels.length > 0) {
    const minMaxData = chartLabels.map((_, idx) => {
      if (idx === 0) return -1;
      if (idx === chartLabels.length - 1) return 1;
      return 0;
    });

    chartDatasets.push({
      data: minMaxData,
      color: () => 'rgba(0,0,0,0)',
      strokeWidth: 0,
    });
  }

  const chartData = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title || 'Biểu đồ CSI theo thời gian'}</Text>

      <LineChart
        data={chartData}
        width={chartWidth}
        height={190}
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#FFFFFF',
          backgroundGradientTo: '#FFFFFF',
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '0',
            strokeWidth: '0',
            stroke: 'transparent',
          },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: '#E5E7EB',
          },
        }}
        bezier={false}
        withShadow={false}
        style={styles.chart}
      />

      {!hasData && (
        <Text style={styles.emptyText}>Chưa có dữ liệu CSI, hiển thị dữ liệu minh hoạ.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default CSIChart;
