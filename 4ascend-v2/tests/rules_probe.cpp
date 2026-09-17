#include <bits/stdc++.h>
#define private public
#include "game.h"
#undef private
#include "encoding.h"

struct Tensor {
    std::array<float, 25 * 81> data{};
    float* channel(int n) { return data.data() + n * 81; }
};
int main(int argc, char** argv) {
    std::string mode = argc > 1 ? argv[1] : "step";
    unsigned seed1, seed2, first, plant, night;
    while (std::cin >> seed1 >> seed2 >> first >> plant >> night) {
        Game game(seed1, seed2, plant);
        game.state.turn_first = game.state.turn_player = first;
        game.state.always_overload = night;
        if (mode == "refresh") {
            int turn, current, asc, grow, charge, fast0, fast1, over, just;
            std::cin >> turn >> current >> asc >> grow >> charge >> fast0 >> fast1 >> over >> just;
            auto& s = game.state;
            s.turn_count=turn; s.turn_player=current; s.ascend_status=asc; s.grow_count=grow;
            s.unascend_charge=charge; s.unascend_chargef[0]=fast0; s.unascend_chargef[1]=fast1;
            s.over_status=over; s.just_unascend=just;
            for (int i=0;i<81;++i) {
                int stone, p; std::cin >> stone >> p;
                if (stone) (stone % 2 ? game.board.black : game.board.white).set(i);
                if (stone >= 3) game.board.used.set(i);
                if (p==1) game.board.plant_lvl1.set(i);
                if (p==2) game.board.plant_lvl2.set(i);
            }
            game.create_plant();
        } else {
            int count; std::cin >> count;
            for(int j=0;j<count;++j) {int move; std::cin >> move; game.step(move);}
        }
        // Every MCTS simulation copies Game. The copy must evolve identically.
        Game copied(game);
        assert(copied.plant == game.plant);
        assert(copied.stones[0] == &copied.board.black);
        auto moves=game.board.get_turns(*game.stones[game.state.turn_player], *game.stones[game.state.turn_player^1]);
        if(mode=="step" && moves.any()) {
            int a=0; while(!moves[a]) ++a;
            Game original(game); original.step(a); copied.step(a);
            assert(original.board.black==copied.board.black);
            assert(original.board.plant_lvl1==copied.board.plant_lvl1);
            assert(original.board.plant_lvl2==copied.board.plant_lvl2);
            assert(original.state.hp[0]==copied.state.hp[0]);
        }
        if(mode=="encode") {
            Tensor t; encode_state(game, game.state.turn_player, t);
            for(float v:t.data) std::cout << v << ' ';
        } else {
            auto& s=game.state;
            std::cout << +s.turn_count << ' ' << +s.turn_player << ' ' << +s.ascend_status << ' '
                      << +s.hp[0] << ' ' << +s.hp[1] << ' ' << +s.grow_count << ' ' << +s.unascend_charge << ' '
                      << +s.unascend_chargef[0] << ' ' << +s.unascend_chargef[1] << ' ' << +s.over_status << ' ' << s.just_unascend;
            for(int i=0;i<81;++i) {
                int stone=game.board.black[i]?1:game.board.white[i]?2:0;
                if(stone && game.board.ascend[i]) stone+=2;
                else if(stone && game.board.used[i]) stone+=4;
                std::cout << ' ' << stone << ' ' << (game.board.plant_lvl2[i]?2:game.board.plant_lvl1[i]?1:0);
            }
        }
        std::cout << '\n';
    }
}
