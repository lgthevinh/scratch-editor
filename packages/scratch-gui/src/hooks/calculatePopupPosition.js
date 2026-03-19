export const PopupSide = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

export const PopupAlign = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right',
    CENTER: 'center'
};

const useCalculatePopupPosition = ({
    relativeElementRef,
    popupRef,
    side,
    align = PopupAlign.CENTER,
    popupWidth,
    spaceForArrow,
    arrowShortSide,
    arrowLongSide,
    counterOffset = 5,
    arrowOffsetFromBottom = 0
}) => {
    const el = relativeElementRef?.current;
    const modalEl = popupRef?.current;
    if (!el || !modalEl) return {};

    const modalHeight = popupRef.current.getBoundingClientRect().height;
    const [arrowHeight, arrowWidth] = (side === PopupSide.LEFT || side === PopupSide.RIGHT) ?
        [arrowLongSide, arrowShortSide] : [arrowShortSide, arrowLongSide];
    const buttonRect = el.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let arrowTop = 0;
    let arrowLeft = 0;

    switch (side) {
    case PopupSide.UP:
        top = buttonRect.top - modalHeight - spaceForArrow;
        break;
    case PopupSide.DOWN:
        top = buttonRect.bottom + spaceForArrow;
        break;
    case PopupSide.LEFT:
        left = buttonRect.left - popupWidth - spaceForArrow;
        break;
    case PopupSide.RIGHT:
        left = buttonRect.right + spaceForArrow;
        break;
    }

    switch (side) {
    case PopupSide.UP:
    case PopupSide.DOWN:
        if (align === PopupAlign.LEFT) {
            left = (buttonRect.left + buttonRect.width) - popupWidth + counterOffset;
        } else if (align === PopupAlign.RIGHT) {
            left = buttonRect.left - counterOffset;
        } else {
            left = buttonRect.left + ((buttonRect.width - popupWidth) / 2);
        }
        break;

    case PopupSide.LEFT:
    case PopupSide.RIGHT:
        if (align === PopupAlign.UP) {
            top = (buttonRect.top + buttonRect.height) - modalHeight - counterOffset;
        } else if (align === PopupAlign.DOWN) {
            top = buttonRect.top - counterOffset;
        } else {
            top = buttonRect.top + ((buttonRect.height - modalHeight) / 2);
        }
        break;
    }

    // Arrow positioning
    switch (side) {
    case PopupSide.UP:
        arrowTop = buttonRect.top - spaceForArrow - arrowOffsetFromBottom;
        arrowLeft = buttonRect.left + ((buttonRect.width - arrowWidth) / 2);
        break;
    case PopupSide.DOWN:
        arrowTop = buttonRect.top + buttonRect.height + spaceForArrow - arrowHeight + arrowOffsetFromBottom;
        arrowLeft = buttonRect.left + ((buttonRect.width - arrowWidth) / 2);
        break;
    case PopupSide.LEFT:
        arrowTop = buttonRect.top + ((buttonRect.height - arrowHeight) / 2);
        arrowLeft = buttonRect.left - spaceForArrow - arrowOffsetFromBottom;
        break;
    case PopupSide.RIGHT:
        arrowTop = buttonRect.top + ((buttonRect.height - arrowHeight) / 2);
        arrowLeft = buttonRect.left + buttonRect.width + spaceForArrow - arrowWidth + arrowOffsetFromBottom;
        break;
    }

    return {top, left, arrowTop, arrowLeft};
};

export default useCalculatePopupPosition;
