const useCalculatePopupPosition = ({
    relativeElementRef,
    popupRef,
    primaryPosition,
    secondaryPosition,
    popupWidth,
    arrowLeftIcon,
    arrowRightIcon,
    arrowUpIcon,
    arrowDownIcon,
    spaceForArrow,
    arrowShortSide,
    arrowLongSide,
    arrowOffsetFromEnd,
    arrowOffsetFromBottom = 0
}) => {
    const modalHeight = popupRef.current.getBoundingClientRect().height;
    const arrowHeight = (primaryPosition === 'left' || primaryPosition === 'right') ? arrowLongSide : arrowShortSide;
    const arrowWidth = (primaryPosition === 'left' || primaryPosition === 'right') ? arrowShortSide : arrowLongSide;

    const el = relativeElementRef?.current;
    const modalEl = popupRef?.current;
    if (!el || !modalEl) return {};

    const buttonRect = el.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let arrowTop = 0;
    let arrowLeft = 0;
    let arrowIcon = null;

    switch (primaryPosition) {
    case 'up':
        top = buttonRect.top - modalHeight - spaceForArrow;
        break;
    case 'down':
        top = buttonRect.bottom + spaceForArrow;
        break;
    case 'left':
        left = buttonRect.left - popupWidth - spaceForArrow;
        break;
    case 'right':
        left = buttonRect.right + spaceForArrow;
        break;
    }

    switch (primaryPosition) {
    case 'up':
    case 'down':
        if (secondaryPosition === 'left') {
            left = (buttonRect.left + buttonRect.width) - popupWidth + arrowOffsetFromEnd;
        } else if (secondaryPosition === 'right') {
            left = buttonRect.left - arrowOffsetFromEnd;
        } else {
            left = buttonRect.left + ((buttonRect.width - popupWidth) / 2);
        }
        break;

    case 'left':
    case 'right':
        if (secondaryPosition === 'up') {
            top = (buttonRect.top + buttonRect.height) - modalHeight - arrowOffsetFromEnd;
        } else if (secondaryPosition === 'down') {
            top = buttonRect.top - arrowOffsetFromEnd;
        } else {
            top = buttonRect.top + ((buttonRect.height - modalHeight) / 2);
        }
        break;
    }

    // Arrow positioning
    switch (primaryPosition) {
    case 'up':
        arrowTop = buttonRect.top - spaceForArrow - arrowOffsetFromBottom;
        arrowLeft = buttonRect.left + ((buttonRect.width - arrowWidth) / 2);
        arrowIcon = arrowDownIcon;
        break;
    case 'down':
        arrowTop = buttonRect.top + buttonRect.height + spaceForArrow - arrowHeight + arrowOffsetFromBottom;
        arrowLeft = buttonRect.left + ((buttonRect.width - arrowWidth) / 2);
        arrowIcon = arrowUpIcon;
        break;
    case 'left':
        arrowTop = buttonRect.top + ((buttonRect.height - arrowHeight) / 2);
        arrowLeft = buttonRect.left - spaceForArrow - arrowOffsetFromBottom;
        arrowIcon = arrowRightIcon;
        break;
    case 'right':
        arrowTop = buttonRect.top + ((buttonRect.height - arrowHeight) / 2);
        arrowLeft = buttonRect.left + buttonRect.width + spaceForArrow - arrowWidth + arrowOffsetFromBottom;
        arrowIcon = arrowLeftIcon;
        break;
    }

    return {top, left, arrowTop, arrowLeft, arrowIcon};
};

export default useCalculatePopupPosition;
