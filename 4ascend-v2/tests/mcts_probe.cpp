#include <bits/stdc++.h>
#include "mcts.h"

Net::Net() = default;
Net::~Net() = default;
void Net::predict(Game&, int, std::vector<float>& logits, float& value) noexcept {
    logits.assign(81,0.0f); value=0.0f;
}
int main() {
    // A defense position: completing a five-chain wins; a quiet move loses.
    Game game(1,100,false);
    game.state.turn_count=20;
    game.state.turn_player=0;
    game.state.ascend_status=1;
    game.state.hp[0]=game.state.hp[1]=1;
    for(int i=0;i<4;++i) game.board.black.set(i);
    for(int i=72;i<76;++i) {game.board.white.set(i);game.board.ascend.set(i);game.board.used.set(i);}
    MCTS mcts(2.0f,200,0.35f,0.0f,123);
    auto policy=mcts.run(game);
    auto q=mcts.get_root_q();
    assert(std::max_element(policy.begin(),policy.end())-policy.begin()==4);
    assert(q[4]==1.0f); // terminal win is positive for root player
    Game lost(game); lost.board.black.reset();
    MCTS losing_search(2.0f,200,0.35f,0.0f,123);
    losing_search.run(lost);
    assert(losing_search.get_root_q()[5]==-1.0f);
    assert(losing_search.get_root_winrate()==0.0f);
    assert(mcts.get_root_winrate()>0.5f);
    assert(game.state.turn_count==20 && game.board.black.count()==4); // search never mutates root
    std::cout << "PASS: MCTS terminal signs, best move, root immutability, reported winrate.\n";
}
