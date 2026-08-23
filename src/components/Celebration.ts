const STAR_POSITIONS = [
  [11, 17, 0],
  [24, 9, 90],
  [39, 18, 35],
  [55, 8, 120],
  [72, 16, 55],
  [88, 10, 145],
  [14, 55, 125],
  [28, 77, 45],
  [47, 87, 155],
  [65, 78, 20],
  [84, 60, 105],
  [92, 39, 65]
] as const;

export function renderCelebration(): string {
  return `
    <div class="celebration" aria-hidden="true">
      ${STAR_POSITIONS.map(
        ([left, top, delay], index) => `
          <span
            class="celebration-star"
            style="--star-left: ${left}%; --star-top: ${top}%; --star-delay: ${delay}ms"
          >${index % 2 === 0 ? '★' : '✦'}</span>`
      ).join('')}
    </div>`;
}

