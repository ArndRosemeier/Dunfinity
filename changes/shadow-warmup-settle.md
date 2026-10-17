# Steadier shadow warm-up under the title

- The shader warm-up waits half a second before drawing its shadow frames. The first shadow build no longer runs over the 100 ms budget while the title plays (it took 40 to 125 ms before, 37 to 53 ms now, measured in software GL).
