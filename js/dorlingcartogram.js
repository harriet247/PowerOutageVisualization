class DorlingCartogram {
	/**
	 * Class constructor with initial configuration
	 * @param {Object}
	 * @param {Array}
	 */
	constructor(_config, _data, _geoData, _dispatcher) {
		this.regions = ['SPP', 'WECC', 'MRO', 'SERC', 'TRE', 'FRCC', 'NPCC', 'RFC'];
		this.colors = d3.schemeDark2;
		this.config = {
			parentElement: _config.parentElement,
			containerWidth: 1200,
			containerHeight: 650,
			margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
			tooltipPadding: 15,
			minRadius: 5,
			maxRadius: 22,
		}
		this.data = _data.filter(d => d.Duration !== 'Unknown' && d['NERC Region'] !== '');
		this.geoData = _geoData;
		this.dispatcher = _dispatcher;
		this.initVis();
	}

	/**
	 * Create scales, axes, and append static elements
	 */
	initVis() {
		let vis = this;

		vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
		vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

		// Define size of SVG drawing area
		vis.svg = d3.select(vis.config.parentElement)
			.append('svg')
			.attr('width', vis.config.containerWidth)
			.attr('height', vis.config.containerHeight)
			.attr('id', 'dorling-cartogram');

		// Append group element that will contain our actual chart 
		// and position it according to the given margin config
		vis.chartArea = vis.svg.append('g')
			.attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

		vis.chart = vis.chartArea.append('g');
		vis.packs = vis.chartArea.append('g').attr('class', 'region-packs');

		vis.projection = d3.geoAlbersUsa()
			.fitSize([vis.width, vis.height], vis.geoData);

		vis.chart.selectAll('.geo-path')
			.data(vis.geoData.features)
			.join('path')
			.attr('class', 'geo-path')
			.attr('d', d3.geoPath(vis.projection))
			.attr('fill', 'none')
			.attr('stroke', 'gray');

		vis.radius = d3.scaleSqrt()
			.domain(d3.extent(vis.data, d => d.Duration))
			.range([vis.config.minRadius, vis.config.maxRadius]);

		vis.color = d3.scaleOrdinal()
			.domain(vis.regions)
			.range(vis.colors);
	}

	_createRegionPacks(nercData) {
		let vis = this;

		const regionsPacked = new Map();

		for (let [k, v] of nercData) {
			v = v.map(d => ({ data: d, r: vis.radius(d.Duration) }));
			const nodes = d3.packSiblings(v);
			const { r } = d3.packEnclose(nodes);
			const [x, y] = vis.projection(vis.geoData.features.find(d => d.properties.NERCregion === k).properties.center);
			regionsPacked.set(k, { nodes, r, x, y });
		}

		return regionsPacked;
	}

	_applySimulation(nodes) {
		let vis = this;

		const simulation = d3.forceSimulation(nodes)
			.force("cx", d3.forceX().x(_ => vis.width / 2).strength(0.02))
			.force("cy", d3.forceY().y(_ => vis.height / 2).strength(0.02))
			.force("x", d3.forceX().x(d => d.x).strength(0.3))
			.force("y", d3.forceY().y(d => d.y).strength(0.3))
			.force("charge", d3.forceManyBody().strength(-1))
			.force("collide", d3.forceCollide().radius(d => d.r + 2).strength(1))
			.stop()

		while (simulation.alpha() > 0.01) {
			simulation.tick();
		}

		return simulation.nodes();
	}

	updateVis() {
		let vis = this;

		vis.data = vis.data.filter(d => d.Duration !== 'Unknown' && d['NERC Region'] !== '');
		vis.data = d3.group(vis.data, d => d["NERC Region"]);
		const regionsPacked = vis._createRegionPacks(vis.data);
		vis.values = vis._applySimulation([...regionsPacked.values()]);

		vis.renderVis();
	}

	_getTooltipList(data) {
		const processedData = [
			'Begin: ' + data['Date Event Begin'] + ' ' + data['Time Event Begin'],
			'End: ' + data['Date of Restoration'] + ' ' + data['Time of Restoration'],
			'Event Type: ' + data['Event Type'],
			'Demand Loss (MW): ' + (data['Demand Loss (MW)'] === '' ? 'Unknown' : data['Demand Loss (MW)']),
			'Number of Customers Affected: ' + (data['Number of Customers Affected'] === '' ? 'Unknown' : data['Number of Customers Affected']),
		];
		return processedData.map(d => `<li class="tooltip-listItem">${d}</li>`).join('');
	}

	renderVis() {
		let vis = this;

		const regionPacks = vis.packs.selectAll('.region-pack')
			.data(vis.values)
			.join('g')
			.classed('region-pack', true)
			.attr('transform', d => `translate(${d.x}, ${d.y})`);

		regionPacks.selectAll('region-circle')
			.data(d => d)
			.join('circle')
			.attr('r', d => d.r)
			.attr('fill', 'none');

		regionPacks.selectAll('.event-circle')
			.data(d => d.nodes)
			.join('circle')
			.classed('event-circle', true)
			.attr('r', d => d.r)
			.attr('cx', d => d.x)
			.attr('cy', d => d.y)
			.attr('fill', d => vis.color(d.data['NERC Region']))
			.attr('fill-opacity', 0.8)
			.on('mouseover', function (_, d) {
				d3.select('#tooltip')
					.style('display', 'block')
					.html(`<ul class="tooltip-list">
						${vis._getTooltipList(d.data)}
                    </ul>`);
				d3.select(this)
					.style('stroke', '#65676a')
					.style('stroke-width', 1);
			})
			.on('mousemove', e => {
				d3.select('#tooltip')
					.style('left', (e.pageX + vis.config.tooltipPadding) + 'px')
					.style('top', (e.pageY + vis.config.tooltipPadding) + 'px');
			})
			.on('mouseleave', function () {
				d3.select('#tooltip')
					.style('display', 'none')
					.style('stroke-width', 0);
				d3.select(this)
					.style('stroke-width', 0);
			});
	}

	onCauseSelected(causes) {
		let vis = this;
		// size of 0 also means all selected
		if (causes.size === 0) {
			d3.selectAll('.event-circle')
				.classed('cause-selected', false)
				.classed('cause-not-selected', false)
				.on('click', function (_, d) {
					vis.dispatcher.call('onCauseSelected', vis, new Set([d.data['Event Type']]));
				})
				.on('mouseover', function (_, d) {
					d3.select('#tooltip')
						.style('display', 'block')
						.html(`<ul class="tooltip-list">
						${vis._getTooltipList(d.data)}
                    </ul>`);
					d3.select(this)
						.style('stroke', '#65676a')
						.style('stroke-width', 1);
				})
				.on('mousemove', e => {
					d3.select('#tooltip')
						.style('left', (e.pageX + vis.config.tooltipPadding) + 'px')
						.style('top', (e.pageY + vis.config.tooltipPadding) + 'px');
				})
				.on('mouseleave', function () {
					d3.select('#tooltip')
						.style('display', 'none')
						.style('stroke-width', 0);
					d3.select(this)
						.style('stroke-width', 0);
				});
		} else {
			d3.selectAll('.event-circle')
				.classed('cause-selected', d => causes.has(d.data['Event Type']))
				.classed('cause-not-selected', d => !causes.has(d.data['Event Type']))
				.on('click', function(_, d) {
					if (!causes.has(d.data['Event Type'])) return;
					causes.delete(d.data['Event Type']);
					vis.dispatcher.call('onCauseSelected', vis, causes);
				})
				.on('mouseover', function(_, d) {
					if (!causes.has(d.data['Event Type'])) return;
					d3.select('#tooltip')
						.style('display', 'block')
						.html(`<ul class="tooltip-list">
						${vis._getTooltipList(d.data)}
                    </ul>`);
					d3.select(this)
						.style('stroke', '#65676a')
						.style('stroke-width', 1);
				})
				.on('mousemove', (e, d) => {
					if (!causes.has(d.data['Event Type'])) return;
					d3.select('#tooltip')
					.style('left', (e.pageX + vis.config.tooltipPadding) + 'px')
					.style('top', (e.pageY + vis.config.tooltipPadding) + 'px');
				})
				.on('mouseleave', function (_, d) {
					if (!causes.has(d.data['Event Type'])) return;
					d3.select('#tooltip')
						.style('display', 'none')
						.style('stroke-width', 0);
					d3.select(this)
						.style('stroke-width', 0);
				});
		}
	}
}