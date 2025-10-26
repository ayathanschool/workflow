import React, { useRef } from 'react';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { useTheme } from '../contexts/ThemeContext';

const AnimatedPage = ({ children, transitionKey }) => {
  const { theme } = useTheme(); // Access theme to force re-render on theme change
  const nodeRef = useRef(null);

  return (
    <SwitchTransition mode="out-in">
      <CSSTransition
        key={transitionKey}
        nodeRef={nodeRef}
        timeout={300}
        classNames="fade"
        unmountOnExit
      >
        <div ref={nodeRef} className="animated-page">
          {children}
        </div>
      </CSSTransition>
    </SwitchTransition>
  );
};

export default AnimatedPage;