class Barchart {

    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data, _dispatcher) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1150,
            containerHeight: _config.containerHeight || 200,
            margin: _config.margin || { top: 20, right: 20, bottom: 45, left: 30 },
            reverseOrder: _config.reverseOrder || false,
            tooltipPadding: _config.tooltipPadding || 15,
            maxBandWidth: 60,
        }
        this.data = _data;
        this.dispatcher = _dispatcher;
        this.initVis();
    }

    /**
     * Initialize scales/axes and append static elements, such as axis titles
     */
    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0])

        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .paddingInner(0.1);

        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSizeOuter(0);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement).append('svg').attr('id', 'bar-chart')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // SVG Group containing the actual chart; D3 margin convention
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append empty x-axis group and move it to the bottom of the chart
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(5,${vis.height})`)


        // Append y-axis group 
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis')

        vis.chartArea = vis.chart.append('g')
            .attr('class', 'chart-area')
            .attr('transform', 'translate(5,0)');

        // Append both axis titles
        vis.chart.append('text')
            .attr('class', 'axis-title')
            .attr('y', vis.height - 35)
            .attr('x', vis.width + 10)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')
            .text('Event Causes');

        vis.svg.append('text')
            .attr('class', 'axis-title')
            .attr('x', 0)
            .attr('y', 3)
            .attr('dy', '.71em')
            .text('Counts');

    }

    /**
     * Prepare data and scales before we render it
     */
    updateVis() {
        let vis = this;

        // groupedData is an array of [{event type name}, data array]
        vis.groupedData = d3.groups(vis.data.filter(d => !!d['NERC Region']), d => d['Event Type']).sort((g1, g2) => g2[1].length - g1[1].length);

        // Specificy x- and y-accessor functions
        vis.xValue = d => d[0];
        vis.yValue = d => d[1].length;

        // Set the scale input domains
        vis.xScale.domain(vis.groupedData.map(vis.xValue));
        vis.yScale.domain([0, d3.max(vis.groupedData, vis.yValue)]);

        vis.renderVis();
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this;

        // Add rectangles
        let bars = vis.chartArea.selectAll('rect')
            .data(vis.groupedData)
            .join('rect')
            .attr('class', 'bar')
            .style('opacity', 0.5)
            .style('fill', '#205cbd')
            .attr('x', d => vis.xScale(vis.xValue(d))
                + Math.max(vis.xScale.bandwidth() - vis.config.maxBandWidth, 0) / 2)
            .attr('width', Math.min(vis.xScale.bandwidth(), vis.config.maxBandWidth))
            .attr('y', vis.height)
            .attr('height', 0);

        let barLabels = vis.chartArea.selectAll('text')
            .data(vis.groupedData)
            .join('text')
            .attr('class', 'bar-label')
            .attr('x', d => vis.xScale(vis.xValue(d)) + vis.xScale.bandwidth() / 2)
            .attr('y', d => vis.yScale(vis.yValue(d)) - 15)
            .style('opacity', 0)

        // Animation
        bars.transition().duration(1000)
            .attr('y', d => vis.yScale(vis.yValue(d)))
            .style('opacity', 0.8)
            .attr('height', d => vis.height - vis.yScale(vis.yValue(d)))

        barLabels.transition().duration(1500)
            .style('opacity', 1)
            .attr("dy", ".75em")
            .attr('text-anchor', 'middle')
            .text(d => d[1].length);

        vis.tooltipList = d => d3.groups(d[1], data => data['NERC Region'])
            .sort((a, b) => b[1].length - a[1].length)
            .map(l => `<li class="tooltip-listItem">${l[0]}: ${l[1].length}</li>`).join('')

        // Tooltip event listeners
        bars
            .on('click', function (_, d) {
                const selectedCauses = vis.chartArea.selectAll('.bar.cause-selected').data().map(d => d[0]);
                vis.dispatcher.call('onCauseSelected', vis, new Set([...selectedCauses, d[0]]));
            })
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('display', 'block')
                    // Format number with million and thousand separator
                    .html(`<div class="tooltip-title">${d[0]}</div>
                    <div class="tooltip-subtitle">Total: ${d[1].length}</div>
                    <ul class="tooltip-list">
                    ${vis.tooltipList(d)}
                    </ul>`);
            })
            .on('mousemove', (event) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            });
        // Action to clear all selected causes when clicking on blank space on the bar chart
        d3.selectAll('#bar-chart')
            .on('click', function (e) {
                if (e.target.className.baseVal.includes('bar')) {
                    return;
                }
                else vis.dispatcher.call('onCauseSelected', vis, new Set());
            });

        // Update axes, wrap x axis ticks text if it's too long
        // Reference https://bl.ocks.org/guypursey/f47d8cd11a8ff24854305505dbbd8c07
        function wrap(text, width) {
            text.each(function () {
                let text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }
        vis.xAxisG
            .call(vis.xAxis)
            .selectAll(".tick text")
            .call(wrap, vis.xScale.bandwidth())
            .transition().duration(1000);

        vis.yAxisG.call(vis.yAxis).call((g) => g.select('.domain').remove()).call((g) => g.select('.tick:first-child').remove());
    }

    /**
    * Interaction between views
    */
    onCauseSelected(causes) {
        let vis = this;
        // size of 0 also means all selected
        if (causes.size === 0) {
            d3.selectAll('.bar')
                .classed('cause-selected', false)
                .classed('cause-not-selected', false)
                .on('click', function (_, d) {
                    vis.dispatcher.call('onCauseSelected', vis, new Set([d[0]]));
                });
        } else {
            d3.selectAll('.bar')
                .classed('cause-selected', d => causes.has(d[0]))
                .classed('cause-not-selected', d => !causes.has(d[0]))
                .on('click', function (_, d) {
                    if (!causes.has(d[0])) {
                        causes.add(d[0]);
                    }
                    else causes.delete(d[0]);
                    vis.dispatcher.call('onCauseSelected', vis, causes);
                });
        }
    }
}