class LineChart{
    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data,_barchart,_dorlingGram) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1150,
            containerHeight: _config.containerHeight || 400,
            margin: _config.margin || { top: 80, right: 50, bottom: 40, left: 30 },
            tooltipPadding: _config.tooltipPadding || 15
        }
        this.data = _data;
        this.barChart = _barchart;
        this.dorlingGram = _dorlingGram;
        this.initVis();
    }

    initVis(){
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Create scales
        vis.xScale = d3.scaleLinear().range([0,vis.width-100]);
        vis.xHalfYearScale = d3.scaleTime().range([0,vis.width]);
        vis.yScale = d3.scaleLinear().range([vis.height,0]);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
        .ticks(6)
        .tickFormat(d3.format("d"))
        .tickSizeOuter(0);
        vis.xHalfYearAxis = d3.axisTop(vis.xHalfYearScale)
        .ticks(d3.timeMonth.every(6))
        .tickFormat((d,i)=>{
            const formating = d3.timeFormat("%B %Y");
            return i%2 !== 1 ? " ": formating(d);
        });

        vis.yAxis = d3.axisLeft(vis.yScale)
        .ticks(8)
        .tickSizeOuter(0);
        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement).append('svg').attr('class', 'line-chart')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

         // Append group element that will contain our actual chart 
        // and position it according to the given margin config
        vis.chart = vis.svg.append('g')
        .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

         // Append empty x-axis group and move it to the bottom of the chart
        vis.xAxisG = vis.chart.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${vis.height})`);

        vis.xAxisHalfYearG = vis.chart.append('g')
        .attr('class','axis x-half-year')
        .attr('transform', `translate(0,-20)`);

        // Append y-axis group
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // Append both axis titles
        vis.chart.append('text')
        .attr('class', 'axis-title')
        .attr('y', vis.height + 25)
        .attr('x', vis.width + 40)
        .attr('dy', '.71em')
        .style('text-anchor', 'end')
        .text('Time');

        vis.svg.append('text')
        .attr('class', 'axis-title')
        .attr('x', 0)
        .attr('y', vis.height-240)
        .attr('dy', '.71em')
        .text('Occurance');

        vis.chartArea = vis.chart.append('g')
        .attr('class', 'chart-area')
        .attr('transform', 'translate(0,0)');

        // append brush element
        vis.brushG = vis.chartArea.append('g')
        .attr('class', 'brush x-brush');

        vis.brush = d3.brushX()
        .on('brush', function({selection}) {
            if (selection) vis.brushed(selection);
        })
        .on("end", function ({selection}) {
            if (!selection) vis.brushed(null);
          })
        .extent([[0, 0], [vis.width, vis.height]])

    

    }
    updateVis(){
        let vis = this;

        // rollup by each time group
        const timeMap = d3.rollup(vis.data,v => v.length, d => d.Year);
        console.log(timeMap)
        const timeArray = Array.from(timeMap, ([key, value]) => ({key, value }));
        timeArray.sort((a,b)=>(a.key-b.key))
        vis.timeArray = timeArray;
    
        vis.xValue = d=>d.key;
        vis.yValue = d=>d.value;
      
        // Set the scale input domains
        const sortTime = [...new Set(timeArray.map(d => d.key))].sort((a,b)=>a-b);
        vis.xDomain  = [sortTime[0],sortTime[sortTime.length-1]];
        vis.xScale.domain(vis.xDomain);
        vis.xHalfYearScale.domain([new Date(2015, 0, 1, 0), new Date(2021,7, 1, 0)]);
        vis.yDomain = [0, d3.max(timeArray, d => d.value)];
        vis.yScale.domain(vis.yDomain);
        // Construct a line generator.
        vis.line = d3.line()
        .x(d => vis.xScale(vis.xValue(d)))
        .y(d => vis.yScale(vis.yValue(d)))
        .curve(d3.curveLinear);

        vis.renderVis();
    
    }
    renderVis(){
        let vis = this;

        vis.circles = vis.chartArea.selectAll('.point')
        .data(vis.timeArray)
        .join('circle')
        .attr('class', `point`)
        .attr('r', 5)
        .attr('cx', d => vis.xScale(vis.xValue(d)))
        .attr('cy', d => vis.yScale(vis.yValue(d)))
        .attr('fill','#222222')
        .style("fill-opacity","40%");

        //add text for each point
        let labels = vis.chartArea.selectAll('.circle-label')
        .data(vis.timeArray)
        .join('text')
        .attr('class', 'circle-label')
        .attr('x', d => vis.xScale(vis.xValue(d))-7)
        .attr('y', d => vis.yScale(vis.yValue(d))-7)
        .style('opacity', 1)
        .text(d=>vis.yValue(d))

        // Add line path
        vis.lines = vis.chart.selectAll('.chart-line')
        .data([vis.timeArray])
        .join('path')
        .attr('class', 'chart-line')
        .attr("fill","none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2.5)
        .attr('d', vis.line);

        vis.xAxisG
        .call(vis.xAxis)
        .call(g => g.select('.domain').remove());
        vis.xAxisG.attr("stroke-opacity",".2")
        .attr("opacity","0.7");

        vis.xAxisHalfYearG
        .call(vis.xHalfYearAxis)
        .call(g => g.select('.domain').remove())
        .call(g=>g.selectAll('.tick')
            .each(function(_,i){
                if ( i%2 !== 1) d3.select(this).remove();
            }));
        vis.xAxisHalfYearG.attr("stroke-opacity",".2")
        .attr("opacity","0.7");

        vis.yAxisG
        .call(vis.yAxis)
        .call(g => g.select('.domain').remove())
        vis.yAxisG.style("stroke-opacity",".2")
        .attr("opacity","0.7");

        vis.brushG
        .call(vis.brush)
    }

    brushed(selection) {
        let vis = this;

        if (selection) {
            // Convert given pixel coordinates (range: [x0,x1]) into a time period (domain: [Date, Date])
            const selectedDomain = selection.map(vis.xScale.invert,vis.xScale);
            // Update x-scale of the focus view accordingly
            let start = vis.findDate(selectedDomain[0]);
            let end  = vis.findDate(selectedDomain[1]);
            // filter data fits in the start/end date
            let fitData = vis.filterDate(start,end,vis.data);
            vis.brushData = fitData;
            console.log(fitData)
            // update two other views with filter data
            vis.barChart.data = vis.brushData;
            vis.dorlingGram.data = vis.brushData;
          } else {
            // undo the update 
            vis.barChart.data = vis.data;
            vis.dorlingGram.data = vis.data;
        }
        vis.barChart.updateVis();
        vis.dorlingGram.updateVis()
    }

    findDate(selectedDate){
        let vis = this;

        let year = Math.trunc(selectedDate);
        let daytemp = vis.getDecimal(selectedDate);
        daytemp = (year%4===0)?daytemp*366:daytemp*365;
        let day = vis.dateFromDay(year,daytemp);
        let timetemp = vis.getDecimal(daytemp)
        timetemp = timetemp* 24;
        let time = vis.timeFromDate(timetemp);
        let hour,minute = "";
        [hour, minute] = time.split(":");
        return new Date(day.setHours(hour,minute))
    }

    dateFromDay(year, day){
        var date = new Date(year,0,1); // initialize a date in `year-01-01`
        return day === 0? date:new Date(date.setDate(day)); // add the number of days
    }


    // reference:https://codepen.io/speedysense/pen/LYVNrwR?editors=0010
    timeFromDate(timeDecimal){
        // Separate the int from the decimal part
        let vis = this;
        var hour = Math.trunc(timeDecimal);
        var decpart = vis.getDecimal(timeDecimal);

        var min = 1 / 60;
        // Round to nearest minute
        decpart = min * Math.round(decpart / min);
        var minute = Math.floor(decpart * 60) + '';

        // Add padding if need
        if (minute.length < 2) {
        minute = '0' + minute; 
        }
        // Concate hours and minutes
        let time = hour + ':' + minute;
        return time;
    }

    getDecimal(input){
        let nstring = (input + "");
        let narray  = nstring.split(".");
        let ret = "0." + ( narray.length > 1 ? narray[1] : "0" );
        return ret;
    }

    filterDate(start,end,data){
        return data.filter(function (d){
            let itemTime = new Date(d["Date Event Begin"]).getTime();
            return (itemTime<=end.getTime())&&(itemTime>=start.getTime());
        });
        
    }


}