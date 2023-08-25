let geoData, projection;
let dispatcher = d3.dispatch('onCauseSelected', 'onRegionSelected');
let barChart, dorlingCartogram, lineChart;

dispatcher.on('onCauseSelected', selectedCauses => {
  barChart.onCauseSelected(selectedCauses);
  dorlingCartogram.onCauseSelected(selectedCauses);
});

dispatcher.on('onRegionSelected', selectedRegion => {
  barChart.onRegionSelected(selectedRegion);
  dorlingCartogram.onRegionSelected(selectedRegion);
});

const eventTypeMap = {
  'Severe Weather/Transmission Interruption': 'Severe Weather',
  'Severe Weather/Distribution Interruption': 'Severe Weather',
  'Weather': 'Severe Weather',
  'Sabotage - Operator Action(s)': 'Sabotage',
  'Distribution Interruption ': 'Distribution Interruption',
  'Sabotage ': 'Sabotage',
  'Actual Physical Event': 'Actual Physical Attack',
  ' Vandalism': 'Vandalism',
  'Vandalism ': 'Vandalism',
  'Physical Attack': 'Actual Physical Attack',
  'Transmission Interruption/Distribution Interruption': 'Transmission Interruption',
  'Suspicious Activity ': 'Suspicious Activity',
  'Severe Weather - Winter': 'Severe Weather',
  'Severe Weather - Wind': 'Severe Weather',
  'Severe Weather - Thunderstorms': 'Severe Weather',
  'Natural Disaster/Transmission Interruption': 'Natural Disaster',
  'Transmission Disruption': 'Transmission Interruption',
  'Weather or Natural Disaster': 'Severe Weather',
  'Suspected Physical Attack': 'Suspicious Activity',
  'Potential Physical Attack': 'Suspicious Activity',
  'Cyber Attack': 'Cyber Event'
}


d3.json('data/combined.json').then(_geoData => {
  geoData = _geoData;

  geoData.features.forEach(feature => {
    const center = d3.geoPath().centroid(feature);
    feature.properties = { ...feature.properties, center };
  });

  return d3.csv('../data/nerc.csv');
}).then(data => {
  data.forEach(d => {
    if (eventTypeMap[d['Event Type']] !== undefined) {
      d['Event Type'] = eventTypeMap[d['Event Type']];
    }
  });

  data.forEach(d => {
    if (d['Date Event Begin'].includes('Unknown') ||
      d['Time Event Begin'].includes('Unknown') ||
      d['Date of Restoration'].includes('Unknown') ||
      d['Time of Restoration'].includes('Unknown')) {
      d['Duration'] = 'Unknown';
    } else {
      const beginSplitted = d['Date Event Begin'].split('/');
      const endSplitted = d['Date of Restoration'].split('/');
      const begin = [beginSplitted[2], beginSplitted[0], beginSplitted[1]].join('-');
      const end = [endSplitted[2], endSplitted[0], endSplitted[1]].join('-');
      d['Duration'] = new Date(end + 'T' + d['Time of Restoration']) - new Date(begin + 'T' + d['Time Event Begin']);
    }

    switch (d['NERC Region']) {
      case 'RF':
        d['NERC Region'] = 'RFC';
        break;
      case 'SPP RE':
        d['NERC Region'] = 'SPP'
        break;
      case 'PR':
      case 'SPP, SERC, TRE':
      case 'N/A':
        d['NERC Region'] = '';
        break;
      default:
        break;
    }
  })

  const regions = ['SPP', 'WECC', 'MRO', 'SERC', 'TRE', 'FRCC', 'NPCC', 'RFC'];
  const colorScale = d3.scaleOrdinal()
    .domain(regions)
    .range(d3.schemeDark2);

  dorlingCartogram = new DorlingCartogram({
    parentElement: '#cartogram',
  }, data, geoData, dispatcher, regions, colorScale);
  dorlingCartogram.updateVis();

  barChart = new Barchart({
    parentElement: '#bar-chart'
  }, data, dispatcher,regions, colorScale);
  barChart.updateVis();

  lineChart = new LineChart({
    parentElement: '#line-chart'
  },data,barChart,dorlingCartogram);
  lineChart.updateVis();


}).catch(e => {
  console.error(e);
});


