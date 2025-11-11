import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface CSIChartProps {
  data?: any[];
}

const CSIChart: React.FC<CSIChartProps> = ({ data }) => {
  // Mock data for demo
  const mockData = {
    labels: ['10:14', '10 th 11', '14:52', '10 th 11', '15:27', '10 th 11'],
    datasets: [
      {
        data: [-0.1, -0.05, 0, 0.05, 0.1, 0.08, 0.06, 0.04, 0.02, 0, 0, 0],
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue color
        strokeWidth: 2,
      },
    ],
  };

  const screenWidth = Dimensions.get('window').width - 64; // Padding

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Biểu đồ CSI theo thời gian</Text>
      
      <LineChart
        data={mockData}
        width={screenWidth}
        height={220}
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#FFFFFF',
          backgroundGradientTo: '#FFFFFF',
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#3B82F6',
          },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: '#E5E7EB',
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

export default CSIChart;
